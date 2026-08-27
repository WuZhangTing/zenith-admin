/**
 * IoT 在线状态与设备接入鉴权。
 *
 * - 在线态 = Redis TTL 键存活（心跳/上报续期，WS 断开主动删除）；不入库，避免写放大
 * - 一机一密 HMAC 签名：sign = HMAC-SHA256(secret, `${sn}\n${ts}\n${body}`) 的 hex，
 *   时间窗 ±300s 防重放；WS 握手 body 为空串
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { IOT_ONLINE_TTL_SECONDS, IOT_SIGN_MAX_SKEW_SECONDS } from '@zenith/shared/iot';
import { db } from '../../db';
import { iotDevices, type IotDeviceRow } from '../../db/schema';
import redis from '../../lib/redis';
import logger from '../../lib/logger';

const ONLINE_PREFIX = 'iot:online:';
/** lastSeenAt 落库节流（秒）：心跳高频，只在超过该间隔时才 UPDATE */
const LAST_SEEN_FLUSH_SECONDS = 60;

export function generateDeviceSn(): string {
  return `SN-${randomBytes(8).toString('hex').toUpperCase()}`;
}

export function generateDeviceSecret(): string {
  return randomBytes(24).toString('hex');
}

export function signDevicePayload(secret: string, sn: string, ts: string, body: string): string {
  return createHmac('sha256', secret).update(`${sn}\n${ts}\n${body}`).digest('hex');
}

/** 校验设备签名并返回设备行（禁用设备拒绝接入） */
export async function authenticateDevice(sn: string | undefined, ts: string | undefined, sign: string | undefined, rawBody: string): Promise<IotDeviceRow> {
  if (!sn || !ts || !sign) throw new HTTPException(401, { message: '缺少设备签名头' });
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > IOT_SIGN_MAX_SKEW_SECONDS) {
    throw new HTTPException(401, { message: '签名时间戳超出允许窗口' });
  }
  const [device] = await db.select().from(iotDevices).where(eq(iotDevices.sn, sn)).limit(1);
  if (!device) throw new HTTPException(401, { message: '设备不存在' });
  const expected = signDevicePayload(device.secret, sn, ts, rawBody);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sign, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(401, { message: '设备签名不合法' });
  }
  if (device.status !== 'enabled') throw new HTTPException(403, { message: '设备已禁用' });
  return device;
}

// ─── 在线状态 ─────────────────────────────────────────────────────────────────
export async function markDeviceOnline(deviceId: number): Promise<void> {
  try {
    await redis.setex(`${ONLINE_PREFIX}${deviceId}`, IOT_ONLINE_TTL_SECONDS, '1');
  } catch (err) {
    logger.warn(`[iot] 在线态写入失败 deviceId=${deviceId}: ${(err as Error).message}`);
  }
}

export async function markDeviceOffline(deviceId: number): Promise<void> {
  try {
    await redis.del(`${ONLINE_PREFIX}${deviceId}`);
  } catch {
    // TTL 到期自然离线
  }
}

export async function isDeviceOnline(deviceId: number): Promise<boolean> {
  try {
    return (await redis.exists(`${ONLINE_PREFIX}${deviceId}`)) === 1;
  } catch {
    return false;
  }
}

/** 批量在线态（列表页）：Redis pipeline 一次取回 */
export async function getOnlineMap(deviceIds: number[]): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>();
  if (deviceIds.length === 0) return map;
  try {
    const pipeline = redis.pipeline();
    for (const id of deviceIds) pipeline.exists(`${ONLINE_PREFIX}${id}`);
    const results = await pipeline.exec();
    deviceIds.forEach((id, i) => map.set(id, results?.[i]?.[1] === 1));
  } catch {
    for (const id of deviceIds) map.set(id, false);
  }
  return map;
}

/**
 * 心跳/上报触达：续在线 TTL + 节流落库 lastSeenAt（首次触达补 activatedAt）。
 * 高频路径绕过 $onUpdate/审计 Proxy 的常规 update，走原生 SQL。
 */
export async function touchDevice(device: IotDeviceRow, opts?: { firmwareVersion?: string }): Promise<void> {
  await markDeviceOnline(device.id);
  const now = Date.now();
  const stale = !device.lastSeenAt || now - device.lastSeenAt.getTime() > LAST_SEEN_FLUSH_SECONDS * 1000;
  const fwChanged = opts?.firmwareVersion && opts.firmwareVersion !== device.firmwareVersion;
  if (!stale && !fwChanged) return;
  try {
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      UPDATE iot_devices SET
        last_seen_at = now(),
        activated_at = COALESCE(activated_at, now())
        ${fwChanged ? sql`, firmware_version = ${opts!.firmwareVersion!}` : sql``}
      WHERE id = ${device.id}
    `);
  } catch (err) {
    logger.warn(`[iot] lastSeenAt 落库失败 deviceId=${device.id}: ${(err as Error).message}`);
  }
}
