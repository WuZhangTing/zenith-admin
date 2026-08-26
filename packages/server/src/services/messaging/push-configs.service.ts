/**
 * App 推送配置（镜像 sms-configs:密钥脱敏、唯一默认、测试发送）。
 * 推送配置是平台级资源（client_apps 无租户),不做租户隔离。
 */
import { and, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { CreatePushConfigInput, PushProvider, TestPushSendInput, UpdatePushConfigInput } from '@zenith/shared/messaging';
import { db } from '../../db';
import { pushConfigs, pushSendLogs, type PushConfigRow } from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { sendPushByProvider } from '../../lib/push-sender';
import { buildWhere, keywordCondition, withPagination } from '../../lib/where-helpers';

const SECRET_MASK = '******';

/** 列表返回脱敏 */
export function mapPushConfigSafe(row: PushConfigRow) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    appKey: row.appKey ? `${row.appKey.slice(0, 4)}${SECRET_MASK}${row.appKey.slice(-4)}` : '',
    apnsProduction: row.apnsProduction,
    isDefault: row.isDefault,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

/** 编辑详情:masterSecret 不返回原文 */
export function mapPushConfigForEdit(row: PushConfigRow) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    appKey: row.appKey,
    masterSecret: '', // 留空,前端不传则后端保持原值
    apnsProduction: row.apnsProduction,
    isDefault: row.isDefault,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function ensurePushConfigExists(id: number): Promise<PushConfigRow> {
  const [row] = await db.select().from(pushConfigs).where(eq(pushConfigs.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '推送配置不存在' });
  return row;
}

export interface ListPushConfigsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  provider?: PushProvider;
  status?: 'enabled' | 'disabled';
}

export async function listPushConfigs(q: ListPushConfigsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildWhere(
    keywordCondition(q.keyword, [pushConfigs.name, pushConfigs.remark]),
    q.provider ? eq(pushConfigs.provider, q.provider) : undefined,
    q.status ? eq(pushConfigs.status, q.status) : undefined,
  );
  const [total, rows] = await Promise.all([
    db.$count(pushConfigs, where),
    withPagination(db.select().from(pushConfigs).where(where).orderBy(pushConfigs.id).$dynamic(), page, pageSize),
  ]);
  return { list: rows.map(mapPushConfigSafe), total, page, pageSize };
}

export async function getPushConfig(id: number) {
  return mapPushConfigForEdit(await ensurePushConfigExists(id));
}

export async function getPushConfigBeforeAudit(id: number) {
  return mapPushConfigSafe(await ensurePushConfigExists(id));
}

export async function createPushConfig(data: CreatePushConfigInput) {
  return db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx.update(pushConfigs).set({ isDefault: false }).where(eq(pushConfigs.isDefault, true));
    }
    const [row] = await tx.insert(pushConfigs).values(data).returning();
    return mapPushConfigSafe(row);
  });
}

export async function updatePushConfig(id: number, data: UpdatePushConfigInput) {
  const existing = await ensurePushConfigExists(id);
  return db.transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.update(pushConfigs).set({ isDefault: false }).where(eq(pushConfigs.isDefault, true));
    }
    // masterSecret 留空表示不更新
    const patch: Partial<typeof pushConfigs.$inferInsert> = { ...data };
    if (!data.masterSecret) delete patch.masterSecret;
    const [row] = await tx.update(pushConfigs).set(patch).where(eq(pushConfigs.id, id)).returning();
    return mapPushConfigSafe(row ?? existing);
  });
}

export async function deletePushConfig(id: number) {
  await ensurePushConfigExists(id);
  await db.delete(pushConfigs).where(eq(pushConfigs.id, id));
}

export async function setPushConfigDefault(id: number) {
  const row = await ensurePushConfigExists(id);
  await db.transaction(async (tx) => {
    await tx.update(pushConfigs).set({ isDefault: false }).where(eq(pushConfigs.isDefault, true));
    await tx.update(pushConfigs).set({ isDefault: true }).where(eq(pushConfigs.id, id));
  });
  return mapPushConfigSafe({ ...row, isDefault: true });
}

/** 获取启用的默认推送配置（运行时发送使用） */
export async function findDefaultPushConfig(): Promise<PushConfigRow | null> {
  const [row] = await db
    .select()
    .from(pushConfigs)
    .where(and(eq(pushConfigs.isDefault, true), eq(pushConfigs.status, 'enabled')))
    .limit(1);
  return row ?? null;
}

/** 测试发送:直发 registrationId,验证凭证与通道,成败都落发送记录 */
export async function testPushSend(configId: number, input: TestPushSendInput) {
  const config = await ensurePushConfigExists(configId);
  const [log] = await db.insert(pushSendLogs).values({
    configId: config.id,
    provider: config.provider,
    deviceCount: 1,
    title: input.title,
    content: input.content,
    status: 'pending',
    source: 'test',
  }).returning({ id: pushSendLogs.id });

  const result = await sendPushByProvider({
    config,
    registrationIds: [input.registrationId],
    title: input.title,
    content: input.content,
  });

  await db.update(pushSendLogs).set({
    status: result.success ? 'success' : 'failed',
    providerMsgId: result.msgId,
    errorMsg: result.errorMsg,
    sentAt: new Date(),
  }).where(eq(pushSendLogs.id, log.id));

  if (!result.success) throw new HTTPException(400, { message: result.errorMsg ?? '推送发送失败' });
  return { msgId: result.msgId ?? null };
}
