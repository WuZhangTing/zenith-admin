/**
 * IoT 产品 / 设备管理 CRUD。
 *
 * 设备列表的属性快照读自 iot_device_state.reported（O(1)），不再扫遥测表。
 */
import { HTTPException } from 'hono/http-exception';
import { createRequire } from 'node:module';
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

/** 导出中心复用：与列表同一访问边界与筛选语义 */
export function buildIotDeviceExportWhere(q: ListIotDevicesQuery): SQL | undefined {
  return buildDeviceWhere(q);
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

// ─── Excel 导入 ───────────────────────────────────────────────────────────────
// 惰性加载：exceljs 模块图大，仅在导入/模板下载时加载
const lazyRequire = createRequire(import.meta.url);
const loadExcelJS = () => lazyRequire('exceljs') as typeof import('exceljs');

export async function getIotDeviceImportTemplate(): Promise<ArrayBuffer> {
  const workbook = new (loadExcelJS().Workbook)();
  const sheet = workbook.addWorksheet('设备导入模板');
  sheet.columns = [
    { header: '设备名称*', key: 'name', width: 22 },
    { header: '产品名称*', key: 'productName', width: 22 },
    { header: 'SN(留空自动生成)', key: 'sn', width: 24 },
    { header: '固件版本', key: 'firmwareVersion', width: 14 },
    { header: '分组名称(逗号分隔)', key: 'groupNames', width: 22 },
    { header: '状态(enabled/disabled)', key: 'status', width: 22 },
    { header: '备注', key: 'remark', width: 28 },
  ];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
  sheet.addRow({
    name: '机房 C-01 温湿度', productName: '温湿度传感器 TH-100', sn: '',
    firmwareVersion: '1.0.0', groupNames: '机房 A 区', status: 'enabled', remark: 'C 栋机房 1 层 01 机柜',
  });
  return workbook.xlsx.writeBuffer();
}

export interface ImportIotDevicesResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importIotDevicesFromFormData(formData: FormData): Promise<ImportIotDevicesResult> {
  const file = formData.get('file');
  if (!file || typeof (file as File).arrayBuffer !== 'function') throw new HTTPException(400, { message: '请上传文件' });
  return importIotDevices(file as File);
}

export async function importIotDevices(file: File): Promise<ImportIotDevicesResult> {
  const user = currentUser();
  const workbook = new (loadExcelJS().Workbook)();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new HTTPException(400, { message: '文件格式无效或工作表为空' });

  const [products, groups, existingSns] = await Promise.all([
    db.select({ id: iotProducts.id, name: iotProducts.name }).from(iotProducts)
      .where(buildWhere(eq(iotProducts.status, 'enabled'), tenantCondition(iotProducts, user))),
    db.select({ id: iotDeviceGroups.id, name: iotDeviceGroups.name }).from(iotDeviceGroups)
      .where(tenantCondition(iotDeviceGroups, user)),
    db.select({ sn: iotDevices.sn }).from(iotDevices),
  ]);
  const productNameMap = new Map<string, number[]>();
  for (const p of products) {
    productNameMap.set(p.name, [...(productNameMap.get(p.name) ?? []), p.id]);
  }
  const groupNameMap = new Map(groups.map((g) => [g.name, g.id]));
  const snSet = new Set(existingSns.map((r) => r.sn));

  const errors: Array<{ row: number; message: string }> = [];
  let success = 0;
  const dataRows: import('exceljs').Row[] = [];
  sheet.eachRow((row, rowNum) => { if (rowNum > 1) dataRows.push(row); });

  for (const row of dataRows) {
    const rowNum = row.number;
    const text = (col: number) => row.getCell(col).text?.toString().trim() ?? '';
    const name = text(1);
    const productName = text(2);
    const snRaw = text(3);
    const firmwareVersion = text(4);
    const groupNamesRaw = text(5);
    const statusRaw = text(6).toLowerCase();
    const remark = text(7);

    if (!name || !productName) { errors.push({ row: rowNum, message: '设备名称、产品名称为必填项' }); continue; }
    const productIds = productNameMap.get(productName) ?? [];
    if (productIds.length === 0) { errors.push({ row: rowNum, message: `产品不存在或已禁用: ${productName}` }); continue; }
    if (productIds.length > 1) { errors.push({ row: rowNum, message: `产品名称不唯一: ${productName}，请先规范产品命名` }); continue; }
    if (snRaw && !/^[0-9A-Za-z-]{4,64}$/.test(snRaw)) { errors.push({ row: rowNum, message: 'SN 需为 4-64 位字母、数字或连字符' }); continue; }
    if (snRaw && snSet.has(snRaw)) { errors.push({ row: rowNum, message: `SN 已存在: ${snRaw}` }); continue; }
    let status: 'enabled' | 'disabled' = 'enabled';
    if (statusRaw) {
      if (statusRaw !== 'enabled' && statusRaw !== 'disabled') {
        errors.push({ row: rowNum, message: `状态值无效: ${statusRaw}（仅支持 enabled/disabled 或留空）` });
        continue;
      }
      status = statusRaw;
    }
    const groupNames = groupNamesRaw ? groupNamesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [];
    const missingGroups = groupNames.filter((g) => !groupNameMap.has(g));
    if (missingGroups.length > 0) { errors.push({ row: rowNum, message: `分组不存在: ${missingGroups.join('、')}` }); continue; }

    const sn = snRaw || generateDeviceSn();
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx.insert(iotDevices).values({
          sn,
          secret: generateDeviceSecret(),
          productId: productIds[0],
          name,
          status,
          firmwareVersion: firmwareVersion || null,
          remark: remark || null,
          tenantId: getCreateTenantId(user),
        }).returning();
        await tx.insert(iotDeviceState).values({ deviceId: created.id });
        const groupIds = groupNames.map((g) => groupNameMap.get(g)).filter((x): x is number => x !== undefined);
        if (groupIds.length > 0) {
          await tx.insert(iotDeviceGroupMembers).values(groupIds.map((groupId) => ({ groupId, deviceId: created.id })));
        }
      });
      snSet.add(sn);
      success += 1;
    } catch (err) {
      errors.push({ row: rowNum, message: (err as Error).message?.slice(0, 120) ?? '写入失败' });
    }
  }
  return { total: dataRows.length, success, failed: errors.length, errors };
}
