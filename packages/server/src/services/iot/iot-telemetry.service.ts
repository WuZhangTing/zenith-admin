/**
 * IoT 遥测与指令。
 *
 * 遥测 ingest 主链路：物模型校验（产品 validationMode）→ 落库 → 影子 reported 合并
 * → 阈值告警判定 → 在线触达。
 *
 * 指令生命周期：pending（落库）→ delivered（WS 推送成功 / HTTP 被拉取）→ acked/failed（设备回执）；
 * 超时不依赖 cron：读取前把越过 expire_at 的 pending/delivered 批量刷成 expired（惰性收敛）。
 * 服务与参数按物模型校验（服务必须已声明，参数按定义检查类型/必填/量程/枚举）。
 */
import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import type { IotCommandAckInput, IotMetricValue, IotTelemetryIngestInput, SendIotCommandInput } from '@zenith/shared/iot';
import { IOT_COMMAND_DEFAULT_TTL_SECONDS } from '@zenith/shared/iot';
import { db } from '../../db';
import {
  iotCommands, iotProducts, iotTelemetry,
  type IotCommandRow, type IotDeviceRow, type IotParamDef, type IotProductPropertyRow,
} from '../../db/schema';
import { formatDateTime, formatNullableDateTime, parseDateTimeInput } from '../../lib/datetime';
import { clampDays, clampLimit } from '../../lib/analytics-helpers';
import { withPagination } from '../../lib/where-helpers';
import logger from '../../lib/logger';
import { ensureIotDeviceExists } from './iot-devices.service';
import { touchDevice } from './iot-access.service';
import { pushCommandToDevice } from './iot-gateway.service';
import { loadThingModel } from './iot-model.service';
import { mergeIotReported } from './iot-shadow.service';
import { evaluateIotThresholdRules } from './iot-alarms.service';
import { evaluateIotAutomationsOnTelemetry } from './iot-automations.service';
import { evaluateIotAnomalies } from './iot-anomaly.service';
import { dispatchIotForward } from './iot-forward.service';
import { pushIotRealtime } from './iot-realtime';

// ─── 遥测 ─────────────────────────────────────────────────────────────────────
/** 单值校验：类型/量程/枚举不符返回 false（该键被丢弃） */
function isValidMetricValue(prop: IotProductPropertyRow, value: IotMetricValue): boolean {
  switch (prop.dataType) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (prop.minValue != null && value < prop.minValue) return false;
      if (prop.maxValue != null && value > prop.maxValue) return false;
      return true;
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && value in (prop.enumOptions ?? {});
    case 'string':
      return typeof value === 'string';
    default:
      return false;
  }
}

/**
 * 按物模型清洗指标袋：
 * - 已声明属性：校验不符 → 丢弃该键
 * - 未声明键：strict 丢弃，loose 放行
 */
function sanitizeMetrics(
  metrics: Record<string, IotMetricValue>,
  propMap: Map<string, IotProductPropertyRow>,
  validationMode: 'loose' | 'strict',
): Record<string, IotMetricValue> {
  const out: Record<string, IotMetricValue> = {};
  for (const [key, value] of Object.entries(metrics)) {
    const prop = propMap.get(key);
    if (prop) {
      if (isValidMetricValue(prop, value)) out[key] = value;
    } else if (validationMode === 'loose') {
      out[key] = value;
    }
  }
  return out;
}

export async function ingestTelemetry(device: IotDeviceRow, input: IotTelemetryIngestInput): Promise<number> {
  const [model, product] = await Promise.all([
    loadThingModel(device.productId),
    db.select({ validationMode: iotProducts.validationMode }).from(iotProducts)
      .where(eq(iotProducts.id, device.productId)).limit(1).then((rows) => rows[0]),
  ]);
  const propMap = new Map(model.properties.map((p) => [p.identifier, p]));
  const mode = product?.validationMode ?? 'loose';

  const rows = input.items
    .map((item) => ({
      deviceId: device.id,
      metrics: sanitizeMetrics(item.metrics, propMap, mode),
      reportedAt: (item.reportedAt ? parseDateTimeInput(item.reportedAt) : null) ?? new Date(),
    }))
    .filter((row) => Object.keys(row.metrics).length > 0);

  if (rows.length > 0) {
    await db.insert(iotTelemetry).values(rows);
    // 影子合并：按上报顺序合并出最新快照
    const merged: Record<string, IotMetricValue> = {};
    let latestAt = rows[0].reportedAt;
    for (const row of rows) {
      Object.assign(merged, row.metrics);
      if (row.reportedAt > latestAt) latestAt = row.reportedAt;
    }
    await mergeIotReported(device.id, merged, latestAt).catch((err) => {
      logger.warn(`[iot] 影子合并失败 deviceId=${device.id}: ${(err as Error).message}`);
    });
    // 管理端实时推送（打开设备详情的页面即时刷新；300ms/设备节流）
    pushIotRealtime({
      type: 'iot:telemetry',
      payload: { deviceId: device.id, metrics: merged, reportedAt: formatDateTime(latestAt) },
    });
    // 阈值告警：逐点判定（连续计数语义依赖点序）
    for (const row of rows) {
      await evaluateIotThresholdRules(device, row.metrics).catch((err) => {
        logger.warn(`[iot] 阈值告警判定失败 deviceId=${device.id}: ${(err as Error).message}`);
      });
    }
    // 场景联动：属性触发（冷却抑制在引擎内）
    for (const row of rows) {
      await evaluateIotAutomationsOnTelemetry(device, row.metrics).catch((err) => {
        logger.warn(`[iot] 场景联动判定失败 deviceId=${device.id}: ${(err as Error).message}`);
      });
    }
    // 遥测异常检测（3σ 基线；失败静默、去抖在服务内）
    await evaluateIotAnomalies(device, merged);
    // 数据流转（fire-and-forget，按最新合并快照推一帧）
    dispatchIotForward('telemetry', device, {
      deviceId: device.id, sn: device.sn, metrics: merged, reportedAt: formatDateTime(latestAt),
    });
  }
  await touchDevice(device, { firmwareVersion: input.firmwareVersion });
  return rows.length;
}

export interface ListTelemetryQuery {
  days?: number;
  limit?: number;
}

/** 设备遥测点列（时间窗内最近 N 条，升序返回供图表直接使用） */
export async function listIotTelemetry(deviceId: number, q: ListTelemetryQuery) {
  await ensureIotDeviceExists(deviceId);
  const days = clampDays(q.days, 1, 90);
  const limit = clampLimit(q.limit, 500, 2000);
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.select().from(iotTelemetry)
    .where(and(eq(iotTelemetry.deviceId, deviceId), gte(iotTelemetry.reportedAt, since)))
    .orderBy(desc(iotTelemetry.reportedAt))
    .limit(limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    metrics: r.metrics,
    reportedAt: formatDateTime(r.reportedAt),
  }));
}

// ─── 指令 ─────────────────────────────────────────────────────────────────────
export function mapIotCommand(row: IotCommandRow) {
  return {
    id: row.id,
    deviceId: row.deviceId,
    service: row.service,
    params: row.params ?? null,
    status: row.status,
    expireAt: formatDateTime(row.expireAt),
    sentAt: formatNullableDateTime(row.sentAt),
    ackedAt: formatNullableDateTime(row.ackedAt),
    response: row.response ?? null,
    errorMsg: row.errorMsg ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: formatDateTime(row.createdAt),
  };
}

/** 惰性超时收敛：把越过期限仍未回执的指令刷成 expired */
async function expireStaleCommands(deviceId: number): Promise<void> {
  await db.update(iotCommands)
    .set({ status: 'expired' })
    .where(and(
      eq(iotCommands.deviceId, deviceId),
      inArray(iotCommands.status, ['pending', 'delivered']),
      lt(iotCommands.expireAt, new Date()),
    ));
}

/** 指令参数按服务定义校验（未声明参数拒绝，必填缺失拒绝，类型/量程/枚举不符拒绝） */
export function validateServiceParams(defs: IotParamDef[], params: Record<string, unknown> | null | undefined): void {
  const defMap = new Map(defs.map((d) => [d.identifier, d]));
  const provided = params ?? {};
  for (const key of Object.keys(provided)) {
    if (!defMap.has(key)) throw new HTTPException(400, { message: `参数 ${key} 未在服务定义中声明` });
  }
  for (const def of defs) {
    const value = provided[def.identifier];
    if (value === undefined || value === null) {
      if (def.required) throw new HTTPException(400, { message: `缺少必填参数 ${def.identifier}` });
      continue;
    }
    switch (def.dataType) {
      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new HTTPException(400, { message: `参数 ${def.identifier} 需要数值` });
        if (def.minValue != null && value < def.minValue) throw new HTTPException(400, { message: `参数 ${def.identifier} 低于下限 ${def.minValue}` });
        if (def.maxValue != null && value > def.maxValue) throw new HTTPException(400, { message: `参数 ${def.identifier} 超出上限 ${def.maxValue}` });
        break;
      }
      case 'boolean':
        if (typeof value !== 'boolean') throw new HTTPException(400, { message: `参数 ${def.identifier} 需要布尔值` });
        break;
      case 'enum': {
        const options = def.enumOptions ?? {};
        if (typeof value !== 'string' || !(value in options)) {
          throw new HTTPException(400, { message: `参数 ${def.identifier} 取值需为 ${Object.keys(options).join(' / ')}` });
        }
        break;
      }
      case 'string':
        if (typeof value !== 'string') throw new HTTPException(400, { message: `参数 ${def.identifier} 需要字符串` });
        break;
      default:
        break;
    }
  }
}

/** 管理端下发：物模型校验 → 落库 → 设备 WS 在线立即推送 */
export async function sendIotCommand(deviceId: number, input: SendIotCommandInput) {
  const device = await ensureIotDeviceExists(deviceId);
  return sendIotCommandToDevice(device, input);
}

/** 批量任务复用：跳过行级权限（调用方已完成目标集校验） */
export async function sendIotCommandToDevice(device: IotDeviceRow, input: SendIotCommandInput) {
  if (device.status !== 'enabled') throw new HTTPException(400, { message: '设备已禁用，无法下发指令' });
  const model = await loadThingModel(device.productId);
  const serviceDef = model.services.find((s) => s.identifier === input.service);
  if (!serviceDef) throw new HTTPException(400, { message: `服务 ${input.service} 未在物模型中声明` });
  validateServiceParams(serviceDef.params ?? [], input.params);

  const ttl = input.ttlSeconds ?? IOT_COMMAND_DEFAULT_TTL_SECONDS;
  const [row] = await db.insert(iotCommands).values({
    deviceId: device.id,
    service: input.service,
    params: input.params ?? null,
    expireAt: new Date(Date.now() + ttl * 1000),
  }).returning();

  const delivered = await pushCommandToDevice(device.sn, {
    commandId: row.id,
    service: row.service,
    params: row.params ?? null,
    expireAt: formatDateTime(row.expireAt),
  });
  if (delivered) {
    const [updated] = await db.update(iotCommands)
      .set({ status: 'delivered', sentAt: new Date() })
      .where(eq(iotCommands.id, row.id))
      .returning();
    return mapIotCommand(updated);
  }
  return mapIotCommand(row);
}

export interface ListCommandsQuery {
  page?: number;
  pageSize?: number;
}

export async function listIotCommands(deviceId: number, q: ListCommandsQuery) {
  await ensureIotDeviceExists(deviceId);
  await expireStaleCommands(deviceId);
  const { page = 1, pageSize = 10 } = q;
  const where = eq(iotCommands.deviceId, deviceId);
  const [total, rows] = await Promise.all([
    db.$count(iotCommands, where),
    withPagination(
      db.select().from(iotCommands).where(where).orderBy(desc(iotCommands.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { list: rows.map(mapIotCommand), total, page, pageSize };
}

// ─── 设备侧接口（ingest / WS 帧共用）──────────────────────────────────────────
/** 设备拉取待执行指令（无 WS 的设备轮询兜底），拉取即 delivered */
export async function pullPendingCommands(device: IotDeviceRow) {
  await expireStaleCommands(device.id);
  const rows = await db.update(iotCommands)
    .set({ status: 'delivered', sentAt: new Date() })
    .where(and(eq(iotCommands.deviceId, device.id), eq(iotCommands.status, 'pending')))
    .returning();
  return rows.map((row) => ({
    commandId: row.id,
    service: row.service,
    params: row.params ?? null,
    expireAt: formatDateTime(row.expireAt),
  }));
}

/** 设备回执：仅允许回写本设备的未终态指令 */
export async function ackIotCommand(device: IotDeviceRow, commandId: number, input: IotCommandAckInput): Promise<void> {
  const [row] = await db.update(iotCommands)
    .set({
      status: input.success ? 'acked' : 'failed',
      ackedAt: new Date(),
      response: input.response ?? null,
      errorMsg: input.success ? null : (input.errorMsg ?? '设备执行失败'),
    })
    .where(and(
      eq(iotCommands.id, commandId),
      eq(iotCommands.deviceId, device.id),
      inArray(iotCommands.status, ['pending', 'delivered']),
    ))
    .returning({ id: iotCommands.id });
  if (!row) throw new HTTPException(404, { message: '指令不存在或已结束' });
}

/** 设备 WS 上线时补推全部 pending 指令 */
export async function getPendingCommandPayloads(deviceId: number) {
  await expireStaleCommands(deviceId);
  const rows = await db.select().from(iotCommands)
    .where(and(eq(iotCommands.deviceId, deviceId), eq(iotCommands.status, 'pending')));
  return rows.map((row) => ({
    commandId: row.id,
    service: row.service,
    params: row.params ?? null,
    expireAt: formatDateTime(row.expireAt),
  }));
}

export async function markCommandsDelivered(commandIds: number[]): Promise<void> {
  if (commandIds.length === 0) return;
  await db.update(iotCommands)
    .set({ status: 'delivered', sentAt: new Date() })
    .where(and(inArray(iotCommands.id, commandIds), eq(iotCommands.status, 'pending')));
}
