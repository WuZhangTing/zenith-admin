/**
 * IoT 设备影子：reported（最新上报快照）与 desired（期望值增量）。
 *
 * - reported：遥测 ingest 时 jsonb 合并（`||`），设备列表/详情 O(1) 读快照
 * - desired ：管理端按物模型 rw 属性设置；版本号随变更 +1；
 *             WS 在线即时推送，HTTP 设备心跳响应捎带；设备回报一致后按键收敛
 */
import { HTTPException } from 'hono/http-exception';
import { eq, sql } from 'drizzle-orm';
import type { IotDesiredPayload, IotMetricValue, SetIotDesiredInput } from '@zenith/shared/iot';
import { db } from '../../db';
import { iotDeviceState, type IotDeviceRow, type IotDeviceStateRow, type IotProductPropertyRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { ensureIotDeviceExists } from './iot-devices.service';
import { loadThingModel } from './iot-model.service';
import { pushDesiredToDevice } from './iot-gateway.service';

export function mapIotShadow(row: IotDeviceStateRow) {
  return {
    deviceId: row.deviceId,
    reported: row.reported ?? {},
    reportedAt: formatNullableDateTime(row.reportedAt),
    desired: row.desired ?? {},
    desiredVersion: row.desiredVersion,
    desiredAt: formatNullableDateTime(row.desiredAt),
    online: row.online,
    updatedAt: formatDateTime(row.updatedAt),
  };
}

async function loadStateRow(deviceId: number): Promise<IotDeviceStateRow> {
  const [row] = await db.select().from(iotDeviceState).where(eq(iotDeviceState.deviceId, deviceId)).limit(1);
  if (row) return row;
  const [created] = await db.insert(iotDeviceState).values({ deviceId })
    .onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(iotDeviceState).where(eq(iotDeviceState.deviceId, deviceId)).limit(1);
  return again;
}

export async function getIotDeviceShadow(deviceId: number) {
  await ensureIotDeviceExists(deviceId);
  return mapIotShadow(await loadStateRow(deviceId));
}

/** 校验期望值：仅 rw 属性可写，值需符合类型/量程/枚举声明 */
function validateDesiredValue(prop: IotProductPropertyRow, value: IotMetricValue): string | null {
  switch (prop.dataType) {
    case 'number': {
      if (typeof value !== 'number') return `属性 ${prop.identifier} 需要数值`;
      if (prop.minValue != null && value < prop.minValue) return `属性 ${prop.identifier} 低于量程下限 ${prop.minValue}`;
      if (prop.maxValue != null && value > prop.maxValue) return `属性 ${prop.identifier} 超出量程上限 ${prop.maxValue}`;
      return null;
    }
    case 'boolean':
      return typeof value === 'boolean' ? null : `属性 ${prop.identifier} 需要布尔值`;
    case 'enum': {
      if (typeof value !== 'string') return `属性 ${prop.identifier} 需要枚举值`;
      const options = prop.enumOptions ?? {};
      return value in options ? null : `属性 ${prop.identifier} 取值需为 ${Object.keys(options).join(' / ')}`;
    }
    case 'string':
      return typeof value === 'string' ? null : `属性 ${prop.identifier} 需要字符串`;
    default:
      return null;
  }
}

/** 管理端设置期望属性：合并 desired、版本 +1、WS 在线即时推送 */
export async function setIotDesired(deviceId: number, input: SetIotDesiredInput) {
  const device = await ensureIotDeviceExists(deviceId);
  if (device.status !== 'enabled') throw new HTTPException(400, { message: '设备已禁用，无法下发期望属性' });
  const model = await loadThingModel(device.productId);
  const propMap = new Map(model.properties.map((p) => [p.identifier, p]));
  for (const [key, value] of Object.entries(input.desired)) {
    const prop = propMap.get(key);
    if (!prop) throw new HTTPException(400, { message: `属性 ${key} 未在物模型中声明` });
    if (prop.accessMode !== 'rw') throw new HTTPException(400, { message: `属性 ${key} 为只读，不可下发` });
    const err = validateDesiredValue(prop, value);
    if (err) throw new HTTPException(400, { message: err });
  }

  await loadStateRow(deviceId);
  const [row] = await db.update(iotDeviceState).set({
    desired: sql`${iotDeviceState.desired} || ${JSON.stringify(input.desired)}::jsonb`,
    desiredVersion: sql`${iotDeviceState.desiredVersion} + 1`,
    desiredAt: new Date(),
  }).where(eq(iotDeviceState.deviceId, deviceId)).returning();

  pushDesiredToDevice(device.sn, { version: row.desiredVersion, desired: row.desired ?? {} });
  return mapIotShadow(row);
}

/** 清空期望值（放弃未确认的下发） */
export async function clearIotDesired(deviceId: number) {
  const device = await ensureIotDeviceExists(deviceId);
  await loadStateRow(deviceId);
  const [row] = await db.update(iotDeviceState).set({
    desired: {},
    desiredVersion: sql`${iotDeviceState.desiredVersion} + 1`,
    desiredAt: new Date(),
  }).where(eq(iotDeviceState.deviceId, deviceId)).returning();
  pushDesiredToDevice(device.sn, { version: row.desiredVersion, desired: {} });
  return mapIotShadow(row);
}

/**
 * 遥测 ingest 合并 reported，并按键收敛 desired：
 * 设备已回报与期望一致的键从 desired 中移除（无需版本 +1，不触发重推）。
 */
export async function mergeIotReported(
  deviceId: number,
  metrics: Record<string, IotMetricValue>,
  reportedAt: Date,
): Promise<void> {
  if (Object.keys(metrics).length === 0) return;
  const patch = JSON.stringify(metrics);
  await db.insert(iotDeviceState)
    .values({ deviceId, reported: metrics, reportedAt })
    .onConflictDoUpdate({
      target: iotDeviceState.deviceId,
      set: {
        reported: sql`${iotDeviceState.reported} || ${patch}::jsonb`,
        reportedAt,
      },
    });
  await db.execute(sql`
    UPDATE iot_device_state SET desired = COALESCE(
      (SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(desired) AS d
       WHERE NOT (reported ? d.key AND reported -> d.key = d.value)),
      '{}'::jsonb)
    WHERE device_id = ${deviceId} AND desired <> '{}'::jsonb
  `);
}

/** 设备侧待同步期望值（WS 上线补推 / 心跳响应捎带）；为空返回 null */
export async function getIotDesiredPayload(device: IotDeviceRow): Promise<IotDesiredPayload | null> {
  const [row] = await db.select({ desired: iotDeviceState.desired, version: iotDeviceState.desiredVersion })
    .from(iotDeviceState).where(eq(iotDeviceState.deviceId, device.id)).limit(1);
  if (!row || !row.desired || Object.keys(row.desired).length === 0) return null;
  return { version: row.version, desired: row.desired };
}
