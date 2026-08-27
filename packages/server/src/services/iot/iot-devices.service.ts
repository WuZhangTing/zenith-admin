/**
 * IoT 产品 / 设备管理 CRUD。
 */
import { HTTPException } from 'hono/http-exception';
import { and, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { CreateIotDeviceInput, CreateIotProductInput, UpdateIotDeviceInput, UpdateIotProductInput } from '@zenith/shared/iot';
import { db } from '../../db';
import { iotDevices, iotProducts, iotTelemetry, type IotDeviceRow, type IotProductRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { currentUser } from '../../lib/context';
import { tenantCondition, getCreateTenantId } from '../../lib/tenant';
import { generateDeviceSecret, generateDeviceSn, getOnlineMap } from './iot-access.service';

// ─── 产品 ─────────────────────────────────────────────────────────────────────
export function mapIotProduct(row: IotProductRow, deviceCount = 0) {
  return {
    id: row.id,
    name: row.name,
    keyMetrics: row.keyMetrics ?? [],
    description: row.description ?? null,
    status: row.status,
    deviceCount,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export interface ListIotProductsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'enabled' | 'disabled';
}

function buildProductWhere(q: ListIotProductsQuery & { id?: number }): SQL | undefined {
  return buildWhere(
    q.id !== undefined ? eq(iotProducts.id, q.id) : undefined,
    keywordCondition(q.keyword, [iotProducts.name, iotProducts.description]),
    q.status ? eq(iotProducts.status, q.status) : undefined,
    tenantCondition(iotProducts, currentUser()),
  );
}

export async function listIotProducts(q: ListIotProductsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildProductWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(iotProducts, where),
    withPagination(
      db.select().from(iotProducts).where(where).orderBy(desc(iotProducts.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  const ids = rows.map((r) => r.id);
  const countRows = ids.length
    ? await db
      .select({ productId: iotDevices.productId, cnt: count() })
      .from(iotDevices)
      .where(inArray(iotDevices.productId, ids))
      .groupBy(iotDevices.productId)
    : [];
  const countMap = new Map(countRows.map((r) => [r.productId, Number(r.cnt)]));
  return { list: rows.map((r) => mapIotProduct(r, countMap.get(r.id) ?? 0)), total, page, pageSize };
}

/** 下拉源：与列表共用访问边界（仅启用产品） */
export async function listAllIotProducts() {
  const rows = await db.select().from(iotProducts)
    .where(buildProductWhere({ status: 'enabled' }))
    .orderBy(desc(iotProducts.id));
  return rows.map((r) => mapIotProduct(r));
}

export async function ensureIotProductExists(id: number): Promise<IotProductRow> {
  const [row] = await db.select().from(iotProducts).where(buildProductWhere({ id })).limit(1);
  if (!row) throw new HTTPException(404, { message: '产品不存在' });
  return row;
}

export async function getIotProduct(id: number) {
  return mapIotProduct(await ensureIotProductExists(id));
}

export async function createIotProduct(data: CreateIotProductInput) {
  const [row] = await db.insert(iotProducts).values({
    name: data.name,
    keyMetrics: data.keyMetrics,
    description: data.description ?? null,
    status: data.status,
    tenantId: getCreateTenantId(currentUser()),
  }).returning();
  return mapIotProduct(row);
}

export async function updateIotProduct(id: number, data: UpdateIotProductInput) {
  const [row] = await db.update(iotProducts).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.keyMetrics !== undefined ? { keyMetrics: data.keyMetrics } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
  }).where(buildProductWhere({ id })).returning();
  if (!row) throw new HTTPException(404, { message: '产品不存在' });
  return mapIotProduct(row);
}

export async function deleteIotProduct(id: number): Promise<void> {
  await ensureIotProductExists(id);
  const deviceCount = await db.$count(iotDevices, eq(iotDevices.productId, id));
  if (deviceCount > 0) throw new HTTPException(400, { message: `产品下还有 ${deviceCount} 台设备，不可删除` });
  await db.delete(iotProducts).where(buildProductWhere({ id }));
}

// ─── 设备 ─────────────────────────────────────────────────────────────────────
export function mapIotDevice(
  row: IotDeviceRow,
  extra?: { productName?: string | null; keyMetrics?: string[]; online?: boolean; latestMetrics?: Record<string, number | string | boolean> | null },
) {
  return {
    id: row.id,
    sn: row.sn,
    secret: row.secret,
    productId: row.productId,
    productName: extra?.productName ?? null,
    keyMetrics: extra?.keyMetrics ?? [],
    name: row.name,
    status: row.status,
    online: extra?.online ?? false,
    firmwareVersion: row.firmwareVersion ?? null,
    activatedAt: formatNullableDateTime(row.activatedAt),
    lastSeenAt: formatNullableDateTime(row.lastSeenAt),
    latestMetrics: extra?.latestMetrics ?? null,
    remark: row.remark ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export interface ListIotDevicesQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'enabled' | 'disabled';
  productId?: number;
  startTime?: string;
  endTime?: string;
}

function buildDeviceWhere(q: ListIotDevicesQuery & { id?: number }): SQL | undefined {
  return buildWhere(
    q.id !== undefined ? eq(iotDevices.id, q.id) : undefined,
    keywordCondition(q.keyword, [iotDevices.sn, iotDevices.name]),
    q.status ? eq(iotDevices.status, q.status) : undefined,
    q.productId ? eq(iotDevices.productId, q.productId) : undefined,
    ...dateRangeConditions(iotDevices.createdAt, q.startTime, q.endTime),
    tenantCondition(iotDevices, currentUser()),
  );
}

/** 各设备最近一条遥测（DISTINCT ON 快照，用于列表关键指标列） */
async function loadLatestMetrics(deviceIds: number[]): Promise<Map<number, Record<string, number | string | boolean>>> {
  if (deviceIds.length === 0) return new Map();
  const { sql } = await import('drizzle-orm');
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (device_id) device_id, metrics
    FROM iot_telemetry
    WHERE device_id = ANY(${deviceIds})
    ORDER BY device_id, reported_at DESC
  `) as unknown as Array<{ device_id: number; metrics: Record<string, number | string | boolean> }>;
  return new Map(rows.map((r) => [r.device_id, r.metrics]));
}

export async function listIotDevices(q: ListIotDevicesQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildDeviceWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(iotDevices, where),
    withPagination(
      db.select({ device: iotDevices, productName: iotProducts.name, keyMetrics: iotProducts.keyMetrics })
        .from(iotDevices)
        .leftJoin(iotProducts, eq(iotDevices.productId, iotProducts.id))
        .where(where)
        .orderBy(desc(iotDevices.id))
        .$dynamic(),
      page,
      pageSize,
    ),
  ]);
  const ids = rows.map((r) => r.device.id);
  const [onlineMap, latestMap] = await Promise.all([getOnlineMap(ids), loadLatestMetrics(ids)]);
  return {
    list: rows.map((r) => mapIotDevice(r.device, {
      productName: r.productName,
      keyMetrics: r.keyMetrics ?? [],
      online: onlineMap.get(r.device.id) ?? false,
      latestMetrics: latestMap.get(r.device.id) ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

export async function ensureIotDeviceExists(id: number): Promise<IotDeviceRow> {
  const [row] = await db.select().from(iotDevices).where(buildDeviceWhere({ id })).limit(1);
  if (!row) throw new HTTPException(404, { message: '设备不存在' });
  return row;
}

export async function getIotDevice(id: number) {
  const device = await ensureIotDeviceExists(id);
  const [product] = await db.select({ name: iotProducts.name, keyMetrics: iotProducts.keyMetrics })
    .from(iotProducts).where(eq(iotProducts.id, device.productId)).limit(1);
  const [onlineMap, latestMap] = await Promise.all([
    getOnlineMap([device.id]),
    loadLatestMetrics([device.id]),
  ]);
  return mapIotDevice(device, {
    productName: product?.name ?? null,
    keyMetrics: product?.keyMetrics ?? [],
    online: onlineMap.get(device.id) ?? false,
    latestMetrics: latestMap.get(device.id) ?? null,
  });
}

export async function createIotDevice(data: CreateIotDeviceInput) {
  await ensureIotProductExists(data.productId);
  const sn = data.sn ?? generateDeviceSn();
  try {
    const [row] = await db.insert(iotDevices).values({
      sn,
      secret: generateDeviceSecret(),
      productId: data.productId,
      name: data.name,
      status: data.status,
      firmwareVersion: data.firmwareVersion ?? null,
      remark: data.remark ?? null,
      tenantId: getCreateTenantId(currentUser()),
    }).returning();
    return mapIotDevice(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, `设备 SN "${sn}" 已存在，请更换`);
    throw err;
  }
}

export async function updateIotDevice(id: number, data: UpdateIotDeviceInput) {
  if (data.productId !== undefined) await ensureIotProductExists(data.productId);
  const [row] = await db.update(iotDevices).set({
    ...(data.productId !== undefined ? { productId: data.productId } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.firmwareVersion !== undefined ? { firmwareVersion: data.firmwareVersion } : {}),
    ...(data.remark !== undefined ? { remark: data.remark } : {}),
  }).where(buildDeviceWhere({ id })).returning();
  if (!row) throw new HTTPException(404, { message: '设备不存在' });
  return mapIotDevice(row);
}

export async function deleteIotDevices(ids: number[]): Promise<number> {
  const where = and(inArray(iotDevices.id, ids), buildDeviceWhere({}));
  const deleted = await db.delete(iotDevices).where(where).returning({ id: iotDevices.id });
  return deleted.length;
}

/** 重置接入密钥：设备需用新 secret 重新签名，旧连接自然失效 */
export async function resetIotDeviceSecret(id: number) {
  await ensureIotDeviceExists(id);
  const [row] = await db.update(iotDevices)
    .set({ secret: generateDeviceSecret() })
    .where(buildDeviceWhere({ id }))
    .returning();
  return mapIotDevice(row);
}

/** 清空设备遥测（重新调试场景） */
export async function clearIotDeviceTelemetry(id: number): Promise<number> {
  await ensureIotDeviceExists(id);
  const deleted = await db.delete(iotTelemetry).where(eq(iotTelemetry.deviceId, id)).returning({ id: iotTelemetry.id });
  return deleted.length;
}
