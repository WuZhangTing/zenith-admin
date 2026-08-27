/**
 * IoT 遥测与指令。
 *
 * 指令生命周期：pending（落库）→ delivered（WS 推送成功 / HTTP 被拉取）→ acked/failed（设备回执）；
 * 超时不依赖 cron：读取前把越过 expire_at 的 pending/delivered 批量刷成 expired（惰性收敛）。
 */
import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import type { IotCommandAckInput, IotTelemetryIngestInput, SendIotCommandInput } from '@zenith/shared/iot';
import { IOT_COMMAND_DEFAULT_TTL_SECONDS } from '@zenith/shared/iot';
import { db } from '../../db';
import { iotCommands, iotTelemetry, type IotCommandRow, type IotDeviceRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime, parseDateTimeInput } from '../../lib/datetime';
import { clampDays, clampLimit } from '../../lib/analytics-helpers';
import { withPagination } from '../../lib/where-helpers';
import { ensureIotDeviceExists } from './iot-devices.service';
import { touchDevice } from './iot-access.service';
import { pushCommandToDevice } from './iot-gateway.service';

// ─── 遥测 ─────────────────────────────────────────────────────────────────────
export async function ingestTelemetry(device: IotDeviceRow, input: IotTelemetryIngestInput): Promise<number> {
  const rows = input.items.map((item) => ({
    deviceId: device.id,
    metrics: item.metrics,
    reportedAt: (item.reportedAt ? parseDateTimeInput(item.reportedAt) : null) ?? new Date(),
  }));
  await db.insert(iotTelemetry).values(rows);
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

/** 管理端下发：落库后若设备 WS 在线立即推送 */
export async function sendIotCommand(deviceId: number, input: SendIotCommandInput) {
  const device = await ensureIotDeviceExists(deviceId);
  if (device.status !== 'enabled') throw new HTTPException(400, { message: '设备已禁用，无法下发指令' });
  const ttl = input.ttlSeconds ?? IOT_COMMAND_DEFAULT_TTL_SECONDS;
  const [row] = await db.insert(iotCommands).values({
    deviceId,
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
