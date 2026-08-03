/**
 * 任务中心幂等作用域 — 数据库集成测试（默认跳过）。
 *
 * 这条链路必须打真库：核心保护来自两个**部分唯一索引**
 * （async_tasks_idem_{tenant,platform}_uq）与冲突后的按 actor 回查，
 * 二者都是 SQL 层语义，mock 掉 db 等于什么都没验证。
 *
 * 回归的是：幂等键此前是单列全局唯一，冲突后仅按 key 回查一行并整行返回
 * （含 payload / result / tenantId / createdBy），于是任意租户的任意用户
 * 只要撞上 key 就能拿到别人的任务内容。
 *
 * 需要可用的 PostgreSQL（默认连接见 .env）。为避免普通 `npm test` 触库，
 * 仅在显式 opt-in 时运行：
 *   PowerShell:  $env:TASK_IDEM_DB_IT='1'; npx vitest run src/lib/task-center/task-idempotency.it.test.ts
 *   Bash:        TASK_IDEM_DB_IT=1 npx vitest run src/lib/task-center/task-idempotency.it.test.ts
 */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';

const RUN = process.env.TASK_IDEM_DB_IT === '1';

// 跨租户用例必须跑在多租户模式下：getCreateTenantId() 在单租户模式恒返回 null，
// 租户维度根本不进库。必须在下方动态 import 触发 config 加载之前设置。
if (RUN) process.env.MULTI_TENANT_MODE = 'true';

/** 测试专用任务类型（避免与真实注册表冲突） */
const TYPE_A = 'it-idem-a';
const TYPE_B = 'it-idem-b';

describe.runIf(RUN)('task center idempotency scope (DB integration)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runner: any;
  let context: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const createdTaskIds: number[] = [];
  const createdUserIds: number[] = [];
  const createdTenantIds: number[] = [];

  /** 以指定用户 / 租户身份提交任务（submitAsyncTask 内部走 currentUser()） */
  async function submitAs(
    userId: number,
    tenantId: number | null,
    input: { taskType: string; idempotencyKey?: string | null; payload?: Record<string, unknown> },
  ) {
    const row = await context.runWithCurrentUser(
      { userId, username: `it-user-${userId}`, roles: [], tenantId },
      () => runner.submitAsyncTask(input, { enqueue: false }),
    );
    if (!createdTaskIds.includes(row.id)) createdTaskIds.push(row.id);
    return row;
  }

  beforeAll(async () => {
    db = (await import('../../db')).db;
    schema = await import('../../db/schema');
    runner = await import('./runner');
    context = await import('../context');
    // 注册两个最小 handler：不能 import routes/tasks/task-demo，那会把整条
    // OpenAPI DTO 依赖链拉进来（需要 extendZodWithOpenApi 已执行）。
    const { registerTaskHandler } = await import('./registry');
    for (const taskType of [TYPE_A, TYPE_B]) {
      registerTaskHandler({
        taskType,
        title: `IT ${taskType}`,
        module: 'IT',
        allowConcurrent: true,
        run: async () => ({ ok: true }),
      });
    }

    // 两个真实用户 + 两个真实租户（created_by / tenant_id 都有外键）
    const [t1] = await db.insert(schema.tenants).values({ name: 'IT 租户 A', code: `it-a-${Date.now()}` }).returning();
    const [t2] = await db.insert(schema.tenants).values({ name: 'IT 租户 B', code: `it-b-${Date.now()}` }).returning();
    createdTenantIds.push(t1.id, t2.id);

    const stamp = Date.now();
    const [u1] = await db.insert(schema.users).values({ username: `it-a-${stamp}`, nickname: 'IT A', password: 'x' }).returning();
    const [u2] = await db.insert(schema.users).values({ username: `it-b-${stamp}`, nickname: 'IT B', password: 'x' }).returning();
    createdUserIds.push(u1.id, u2.id);

    Object.assign(globalThis, { __itUsers: [u1.id, u2.id], __itTenants: [t1.id, t2.id] });
  });

  afterAll(async () => {
    if (createdTaskIds.length) await db.delete(schema.asyncTasks).where(inArray(schema.asyncTasks.id, createdTaskIds));
    if (createdUserIds.length) await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
    if (createdTenantIds.length) await db.delete(schema.tenants).where(inArray(schema.tenants.id, createdTenantIds));
    await (await import('../../db')).closeDb();
  });

  function ids() {
    const g = globalThis as unknown as { __itUsers: number[]; __itTenants: number[] };
    return { userA: g.__itUsers[0], userB: g.__itUsers[1], tenantA: g.__itTenants[0], tenantB: g.__itTenants[1] };
  }

  it('同一用户同类型同 key 复用同一任务（幂等本身必须生效）', async () => {
    const { userA } = ids();
    const key = `it-same-${Date.now()}`;
    const first = await submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key, payload: { n: 1 } });
    const second = await submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key, payload: { n: 2 } });

    expect(second.id).toBe(first.id);
    expect(second.payload).toEqual({ n: 1 });
  });

  it('不同用户用同一 key 各建各的任务，互不可见', async () => {
    const { userA, userB } = ids();
    const key = `it-cross-user-${Date.now()}`;
    const a = await submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key, payload: { owner: 'A' } });
    const b = await submitAs(userB, null, { taskType: TYPE_A, idempotencyKey: key, payload: { owner: 'B' } });

    expect(b.id).not.toBe(a.id);
    expect(b.createdBy).toBe(userB);
    // 回归点：此前 B 会拿到 A 的整行（含 payload）
    expect(b.payload).toEqual({ owner: 'B' });
  });

  it('不同租户用同一 key 各建各的任务，互不可见', async () => {
    const { userA, tenantA, tenantB } = ids();
    const key = `it-cross-tenant-${Date.now()}`;
    const a = await submitAs(userA, tenantA, { taskType: TYPE_A, idempotencyKey: key, payload: { t: 'A' } });
    const b = await submitAs(userA, tenantB, { taskType: TYPE_A, idempotencyKey: key, payload: { t: 'B' } });

    expect(b.id).not.toBe(a.id);
    expect(a.tenantId).toBe(tenantA);
    expect(b.tenantId).toBe(tenantB);
    expect(b.payload).toEqual({ t: 'B' });
  });

  it('平台级任务（tenantId 为 null）与租户任务同 key 不互相复用', async () => {
    const { userA, tenantA } = ids();
    const key = `it-platform-${Date.now()}`;
    const platform = await submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key, payload: { s: 'platform' } });
    const scoped = await submitAs(userA, tenantA, { taskType: TYPE_A, idempotencyKey: key, payload: { s: 'tenant' } });

    expect(scoped.id).not.toBe(platform.id);
    expect(platform.tenantId).toBeNull();
    expect(scoped.tenantId).toBe(tenantA);
  });

  it('同用户同 key 但任务类型不同，不复用', async () => {
    const { userA } = ids();
    const key = `it-cross-type-${Date.now()}`;
    const batch = await submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key });
    const serial = await submitAs(userA, null, { taskType: TYPE_B, idempotencyKey: key });

    expect(serial.id).not.toBe(batch.id);
    expect(serial.taskType).toBe(TYPE_B);
  });

  it('未传 key 的任务不受唯一约束影响（可重复提交）', async () => {
    const { userA } = ids();
    const a = await submitAs(userA, null, { taskType: TYPE_A });
    const b = await submitAs(userA, null, { taskType: TYPE_A });

    expect(b.id).not.toBe(a.id);
  });

  it('并发提交同一 key 仅落一行，且都返回同一任务', async () => {
    const { userA } = ids();
    const key = `it-race-${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => submitAs(userA, null, { taskType: TYPE_A, idempotencyKey: key })),
    );
    const uniqueIds = new Set(results.map((r) => r.id));
    expect(uniqueIds.size).toBe(1);
  });
});
