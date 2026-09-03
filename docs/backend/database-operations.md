# 数据库操作规范

本页汇总 Zenith Admin 后端数据库查询与写入规范，覆盖计数、分页、关联查询、条件构造、批量写入、租户过滤与审计字段。

## 计数查询

单表计数使用 `db.$count(table, where)`：

```ts
const total = await db.$count(users, and(eq(users.status, 'enabled'), tenantScope(users)));
```

需要跨表过滤、分组或 distinct 聚合时可使用 `db.select({ cnt: count() }).from(...).join(...).groupBy(...)`。

## `updatedAt` 自动更新

schema 中的 `updatedAt` 统一声明 `.$onUpdate(() => new Date())`。普通 update 不手动传 `updatedAt`：

```ts
await db.update(users).set({ name: 'Alice' }).where(eq(users.id, id));
```

`onConflictDoUpdate({ set })` 不会触发 `$onUpdate`，upsert 的 `set` 中需要显式写更新时间。

## 分页列表的 count + list 并行查询

分页列表的 `total` 与 `list` 是独立查询，应使用 `Promise.all` 并行：

```ts
const [total, rows] = await Promise.all([
  db.$count(xxxs, where),
  withPagination(
    db.select().from(xxxs).where(where).orderBy(xxxs.id).$dynamic(),
    page,
    pageSize,
  ),
]);
```

仪表盘等多个独立统计值也按同样方式并行读取。

## SQL 调试日志（Drizzle Logger）

`packages/server/src/db/index.ts` 集成 `DrizzleLogger`。设置：

```dotenv
LOG_LEVEL=debug
```

开启后 SQL 与参数通过 pino 以 `debug` 级别输出。

## 分页：`withPagination`（SQL-builder）与 `pageOffset`（RQB）

| 查询风格 | 分页方式 | 来源 |
| --- | --- | --- |
| SQL-builder：`db.select().from()` | `withPagination(query.$dynamic(), page, pageSize)` | `lib/where-helpers` |
| RQB：`db.query.xxx.findMany()` | `offset: pageOffset(page, pageSize)` | `lib/pagination` |

```ts
withPagination(
  db.select().from(xxxs).where(where).orderBy(xxxs.id).$dynamic(),
  page,
  pageSize,
);

db.query.xxxs.findMany({
  where,
  orderBy: xxxs.id,
  limit: pageSize,
  offset: pageOffset(page, pageSize),
});
```

不要手写 `(page - 1) * pageSize`。

## 关联查询优先使用 RQB

`db` 实例传入了完整 `schema`，关联统一声明在 `packages/server/src/db/schema/relations.ts`。有关联数据时优先使用 RQB：

```ts
const row = await db.query.workflowDefinitions.findFirst({
  where: eq(workflowDefinitions.id, id),
  with: {
    createdByUser: { columns: { nickname: true } },
  },
});
```

若缺少关联，在 `relations.ts` 中补充 `xxxRelations`，不要因为缺关联而退回手写 JOIN。

常用 `with` 字段：

| 表 | 常用 `with` 字段 |
| --- | --- |
| `users` | `department`、`tenant`、`userRoles`、`userPositions`、`userGroupMembers` |
| `roles` | `tenant`、`userRoles`、`roleMenus`、`deptScopes` |
| `managedFiles` | `storageConfig`、`tenant`、`createdByUser` |
| `exportJobs` | `createdByUser` |
| `asyncTasks` | `createdByUser` |
| `workflowInstances` | `definition`、`initiator`、`tenant`、`tasks` |
| `members` | `level`、`tenant`、`pointAccount`、`wallet`、`memberCoupons`、`checkins` |
| `paymentOrders` | `channelConfig`、`user`、`refunds` |
| `wikiDocs` | `space`、`parent`、`creator`、`updater` |

保留手写 JOIN 的场景：聚合计数需要跨表过滤、WHERE 依赖关联表列、查询系统 catalog / pg_stat_*、Drizzle RQB 无法表达的 SQL。

## 条件算子一律用 drizzle-orm 原生函数

比较、判空、范围筛选使用 `eq` / `ne` / `gt` / `gte` / `lt` / `lte` / `isNull` / `isNotNull` / `inArray` / `notInArray` / `and` / `or` / `like` / `ilike` 等函数。

```ts
where(and(eq(tenants.code, data.code), ne(tenants.id, id)));
where(and(eq(users.username, 'admin'), isNull(users.tenantId)));
```

裸 `sql` 仅用于 Drizzle 没有抽象的表达式，例如 `date(col AT TIME ZONE 'UTC')`、`setval()`、`pg_stat_*`、表达式索引配套查询、`excluded.xxx` upsert 引用。

## 条件构造 helper

用户输入参与 WHERE 时优先使用 `packages/server/src/lib/where-helpers.ts`：

| 场景 | 工具 |
| --- | --- |
| 用户输入参与 LIKE / ILIKE（单列或跨列、包含或前缀） | `keywordCondition(keyword, [colA, colB], mode?, match?)` |
| 时间范围闭区间 | `dateRangeConditions(column, start, end)` |
| 合并可选条件（含租户 / 数据权限条件） | `buildWhere(...conditions)` |
| SQL-builder 分页 | `withPagination(qb.$dynamic(), page, pageSize)` |

```ts
const where = buildWhere(
  keywordCondition(q.keyword, [users.username, users.nickname], 'ilike'),
  q.status ? eq(users.status, q.status) : undefined,
  ...dateRangeConditions(users.createdAt, q.startTime, q.endTime),
  tenantScope(users),
);
```

`keywordCondition()` 会 trim、处理空串并转义 `%`、`_`、`\`；列参数接受裸列或 SQL 表达式。
时间范围使用闭区间；纯日期起点按 `00:00:00`，终点按 `23:59:59.999`。

## 租户过滤

多租户表查询使用 `tenantCondition(table, user)` 或零参 `tenantScope(table)`；创建记录使用 `getCreateTenantId(user)` 或零参 `currentCreateTenantId()`。

```ts
import { tenantScope, currentCreateTenantId } from '../../lib/tenant';

const where = buildWhere(tenantScope(orders), keywordCondition(q.keyword, [orders.no], 'ilike'));
await db.insert(orders).values({ ...data, tenantId: currentCreateTenantId() });
```

租户模式关闭时过滤条件返回 `undefined`；平台超管未切换视角时不过滤；超管切换视角或普通租户用户按生效租户过滤。

## 批量 upsert 与 `excluded` 引用

不要在循环里逐条 upsert。使用 `.values([...])` 与 `onConflictDoUpdate`：

```ts
await db.insert(menus).values(menuRows).onConflictDoUpdate({
  target: menus.id,
  set: {
    parentId: sql`excluded.parent_id`,
    title: sql`excluded.title`,
    sort: sql`excluded.sort`,
    updatedAt: new Date(),
  },
});
```

要点：

- `excluded.xxx` 中的列名是数据库列名（snake_case），不是 JS 属性名。
- `db/index.ts` 的 Proxy 会为带审计列的 upsert 注入 `updatedBy`。
- `updatedAt` 仍需手动写入，因为 `$onUpdate` 不覆盖 `onConflictDoUpdate`。

## 带 NULL 列的复合唯一约束幂等陷阱

PostgreSQL 唯一约束中 `NULL != NULL`。复合唯一键包含可空列时，`onConflictDoNothing` 可能无法阻止重复插入。

```ts
// tenant_id 为 NULL 时不会互相冲突
await db.insert(users).values({ username: 'admin', tenantId: null }).onConflictDoNothing();
```

处理方式：

- 种子 / 初始化数据：先按完整业务键查询，存在则更新或跳过，不存在再插入。
- 需要数据库强约束的幂等键：拆成互补的部分唯一索引，例如任务中心的 `async_tasks_idem_tenant_uq` 与 `async_tasks_idem_platform_uq`。

```ts
const [existing] = await db.select({ id: users.id })
  .from(users)
  .where(and(eq(users.username, 'admin'), isNull(users.tenantId)))
  .limit(1);

if (!existing) {
  await db.insert(users).values({ username: 'admin', tenantId: null, ...rest });
}
```

## 审计字段写入

带 `auditColumns()` 的表由 `db/index.ts` 自动注入 `createdBy` / `updatedBy`。业务代码不要手动赋值。非 HTTP 场景需要指定操作者时，用 `runAsUser(userId, fn)` 包裹写入。
