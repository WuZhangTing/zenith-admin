/**
 * IoT 产品 / 设备管理 CRUD。
 *
 * 设备列表的属性快照读自 iot_device_state.reported（O(1)），不再扫遥测表。
 */
import { HTTPException } from 'hono/http-exception';
import { and, count, desc, eq, exists, inArray, type SQL } from 'drizzle-orm';
import type { CreateIotDeviceInput, CreateIotProductInput, UpdateIotDeviceInput, UpdateIotProductInput } from '@zenith/shared/iot';
import { db } from '../../db';
import type { DbExecutor } from '../../db/types';
import {
  iotDeviceGroupMembers, iotDeviceGroups, iotDevices, iotDeviceState, iotProductEvents,
  iotProductProperties, iotProducts, iotProductServices, iotTelemetry,
  type IotDeviceRow, type IotDeviceStateRow, type IotProductRow,
} from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { currentUser } from '../../lib/context';
import { tenantCondition, getCreateTenantId } from '../../lib/tenant';
import { clearOnlineKeys, generateDeviceSecret, generateDeviceSn, getOnlineMap } from './iot-access.service';
import { recordIotLifecycleEvent } from './iot-events.service';

/** 批量读取影子（设备列表快照列） */
async function loadIotStates(deviceIds: number[]): Promise<Map<number, IotDeviceStateRow>> {
  if (deviceIds.length === 0) return new Map();
  const rows = await db.select().from(iotDeviceState)
    .where(inArray(iotDeviceState.deviceId, deviceIds));
  return new Map(rows.map((r) => [r.deviceId, r]));
}

// ─── 产品 ─────────────────────────────────────────────────────────────────────
export function mapIotProduct(
  row: IotProductRow,
  extra?: { deviceCount?: number; propertyCount?: number; serviceCount?: number; eventCount?: number },
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    validationMode: row.validationMode,
    status: row.status,
    deviceCount: extra?.deviceCount ?? 0,
    propertyCount: extra?.propertyCount ?? 0,
    serviceCount: extra?.serviceCount ?? 0,
    eventCount: extra?.eventCount ?? 0,
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

async function loadCountMap(table: typeof iotDevices | typeof iotProductProperties | typeof iotProductServices | typeof iotProductEvents, productIds: number[]): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({ productId: table.productId, cnt: count() })
    .from(table)
    .where(inArray(table.productId, productIds))
    .groupBy(table.productId);
  return new Map(rows.map((r) => [r.productId, Number(r.cnt)]));
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
  const [deviceCounts, propCounts, svcCounts, evtCounts] = await Promise.all([
    loadCountMap(iotDevices, ids),
    loadCountMap(iotProductProperties, ids),
    loadCountMap(iotProductServices, ids),
    loadCountMap(iotProductEvents, ids),
  ]);
  return {
    list: rows.map((r) => mapIotProduct(r, {
      deviceCount: deviceCounts.get(r.id) ?? 0,
      propertyCount: propCounts.get(r.id) ?? 0,
      serviceCount: svcCounts.get(r.id) ?? 0,
      eventCount: evtCounts.get(r.id) ?? 0,
    })),
    total,
    page,
    pageSize,
  };
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
  const row = await ensureIotProductExists(id);
  const [deviceCounts, propCounts, svcCounts, evtCounts] = await Promise.all([
    loadCountMap(iotDevices, [id]),
    loadCountMap(iotProductProperties, [id]),
    loadCountMap(iotProductServices, [id]),
    loadCountMap(iotProductEvents, [id]),
  ]);
  return mapIotProduct(row, {
    deviceCount: deviceCounts.get(id) ?? 0,
    propertyCount: propCounts.get(id) ?? 0,
    serviceCount: svcCounts.get(id) ?? 0,
    eventCount: evtCounts.get(id) ?? 0,
  });
}

export async function createIotProduct(data: CreateIotProductInput) {
  const [row] = await db.insert(iotProducts).values({
    name: data.name,
    description: data.description ?? null,
    validationMode: data.validationMode,
    status: data.status,
    tenantId: getCreateTenantId(currentUser()),
  }).returning();
  return mapIotProduct(row);
}

export async function updateIotProduct(id: number, data: UpdateIotProductInput) {
  const [row] = await db.update(iotProducts).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.validationMode !== undefined ? { validationMode: data.validationMode } : {}),
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
  extra?: {
    productName?: string | null;
    online?: boolean;
    state?: IotDeviceStateRow | null;
    groupIds?: number[];
    groupNames?: string[];
  },
) {
  return {
    id: row.id,
    sn: row.sn,
    secret: row.secret,
    productId: row.productId,
    productName: extra?.productName ?? null,
    name: row.name,
    status: row.status,
    online: extra?.online ?? false,
    firmwareVersion: row.firmwareVersion ?? null,
    activatedAt: formatNullableDateTime(row.activatedAt),
    lastSeenAt: formatNullableDateTime(row.lastSeenAt),
    reported: extra?.state?.reported ?? null,
    desired: extra?.state?.desired ?? null,
    groupIds: extra?.groupIds ?? [],
    groupNames: extra?.groupNames ?? [],
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
  groupId?: number;
  startTime?: string;
  endTime?: string;
}

function buildDeviceWhere(q: ListIotDevicesQuery & { id?: number }): SQL | undefined {
  return buildWhere(
    q.id !== undefined ? eq(iotDevices.id, q.id) : undefined,
    keywordCondition(q.keyword, [iotDevices.sn, iotDevices.name]),
    q.status ? eq(iotDevices.status, q.status) : undefined,
    q.productId ? eq(iotDevices.productId, q.productId) : undefined,
    q.groupId
      ? exists(db.select({ one: iotDeviceGroupMembers.deviceId }).from(iotDeviceGroupMembers)
        .where(and(eq(iotDeviceGroupMembers.deviceId, iotDevices.id), eq(iotDeviceGroupMembers.groupId, q.groupId))))
      : undefined,
    ...dateRangeConditions(iotDevices.createdAt, q.startTime, q.endTime),
    tenantCondition(iotDevices, currentUser()),
  );
}

/** 设备 → 所属分组（id/名称）批量映射 */
async function loadGroupMap(deviceIds: number[]): Promise<Map<number, { ids: number[]; names: string[] }>> {
  const map = new Map<number, { ids: number[]; names: string[] }>();
  if (deviceIds.length === 0) return map;
  const rows = await db.select({
    deviceId: iotDeviceGroupMembers.deviceId,
    groupId: iotDeviceGroupMembers.groupId,
    groupName: iotDeviceGroups.name,
  })
    .from(iotDeviceGroupMembers)
    .innerJoin(iotDeviceGroups, eq(iotDeviceGroupMembers.groupId, iotDeviceGroups.id))
    .where(inArray(iotDeviceGroupMembers.deviceId, deviceIds));
  for (const r of rows) {
    const entry = map.get(r.deviceId) ?? { ids: [], names: [] };
    entry.ids.push(r.groupId);
    entry.names.push(r.groupName);
    map.set(r.deviceId, entry);
  }
  return map;
}

export async function listIotDevices(q: ListIotDevicesQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildDeviceWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(iotDevices, where),
    withPagination(
      db.select({ device: iotDevices, productName: iotProducts.name })
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
  const [onlineMap, stateMap, groupMap] = await Promise.all([
    getOnlineMap(ids),
    loadIotStates(ids),
    loadGroupMap(ids),
  ]);
  return {
    list: rows.map((r) => mapIotDevice(r.device, {
      productName: r.productName,
      online: onlineMap.get(r.device.id) ?? false,
      state: stateMap.get(r.device.id) ?? null,
      groupIds: groupMap.get(r.device.id)?.ids ?? [],
      groupNames: groupMap.get(r.device.id)?.names ?? [],
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
  const [product] = await db.select({ name: iotProducts.name })
    .from(iotProducts).where(eq(iotProducts.id, device.productId)).limit(1);
  const [onlineMap, stateMap, groupMap] = await Promise.all([
    getOnlineMap([device.id]),
    loadIotStates([device.id]),
    loadGroupMap([device.id]),
  ]);
  return mapIotDevice(device, {
    productName: product?.name ?? null,
    online: onlineMap.get(device.id) ?? false,
    state: stateMap.get(device.id) ?? null,
    groupIds: groupMap.get(device.id)?.ids ?? [],
    groupNames: groupMap.get(device.id)?.names ?? [],
  });
}

/** 先删后插，原子性更新设备的分组关联 */
async function setDeviceGroups(executor: DbExecutor, deviceId: number, groupIds: number[]): Promise<void> {
  await executor.delete(iotDeviceGroupMembers).where(eq(iotDeviceGroupMembers.deviceId, deviceId));
  if (groupIds.length > 0) {
    await executor.insert(iotDeviceGroupMembers).values(groupIds.map((groupId) => ({ groupId, deviceId })));
  }
}

async function ensureGroupsExist(groupIds: number[] | undefined): Promise<void> {
  if (!groupIds || groupIds.length === 0) return;
  const rows = await db.select({ id: iotDeviceGroups.id }).from(iotDeviceGroups)
    .where(inArray(iotDeviceGroups.id, groupIds));
  if (rows.length !== new Set(groupIds).size) throw new HTTPException(400, { message: '存在无效的设备分组' });
}

export async function createIotDevice(data: CreateIotDeviceInput) {
  await ensureIotProductExists(data.productId);
  await ensureGroupsExist(data.groupIds);
  const sn = data.sn ?? generateDeviceSn();
  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(iotDevices).values({
        sn,
        secret: generateDeviceSecret(),
        productId: data.productId,
        name: data.name,
        status: data.status,
        firmwareVersion: data.firmwareVersion ?? null,
        remark: data.remark ?? null,
        tenantId: getCreateTenantId(currentUser()),
      }).returning();
      await tx.insert(iotDeviceState).values({ deviceId: created.id });
      if (data.groupIds?.length) await setDeviceGroups(tx, created.id, data.groupIds);
      return created;
    });
    return mapIotDevice(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, `设备 SN "${sn}" 已存在，请更换`);
    throw err;
  }
}

export async function updateIotDevice(id: number, data: UpdateIotDeviceInput) {
  if (data.productId !== undefined) await ensureIotProductExists(data.productId);
  await ensureGroupsExist(data.groupIds);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(iotDevices).set({
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.firmwareVersion !== undefined ? { firmwareVersion: data.firmwareVersion } : {}),
      ...(data.remark !== undefined ? { remark: data.remark } : {}),
    }).where(buildDeviceWhere({ id })).returning();
    if (!updated) throw new HTTPException(404, { message: '设备不存在' });
    if (data.groupIds !== undefined) await setDeviceGroups(tx, id, data.groupIds);
    return updated;
  });
  return getIotDevice(row.id);
}

export async function deleteIotDevices(ids: number[]): Promise<number> {
  const where = and(inArray(iotDevices.id, ids), buildDeviceWhere({}));
  const deleted = await db.delete(iotDevices).where(where).returning({ id: iotDevices.id });
  await clearOnlineKeys(deleted.map((d) => d.id));
  return deleted.length;
}

/** 重置接入密钥：设备需用新 secret 重新签名，旧连接自然失效 */
export async function resetIotDeviceSecret(id: number) {
  await ensureIotDeviceExists(id);
  const [row] = await db.update(iotDevices)
    .set({ secret: generateDeviceSecret() })
    .where(buildDeviceWhere({ id }))
    .returning();
  await recordIotLifecycleEvent(id, 'secret_reset');
  return mapIotDevice(row);
}

/** 清空设备遥测（重新调试场景）：同步重置影子 reported 快照 */
export async function clearIotDeviceTelemetry(id: number): Promise<number> {
  await ensureIotDeviceExists(id);
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx.delete(iotTelemetry).where(eq(iotTelemetry.deviceId, id)).returning({ id: iotTelemetry.id });
    await tx.update(iotDeviceState).set({ reported: {}, reportedAt: null }).where(eq(iotDeviceState.deviceId, id));
    return rows;
  });
  return deleted.length;
}
