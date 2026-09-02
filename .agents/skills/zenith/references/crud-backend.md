# CRUD 后端实现参考（Step 1-7）

后端主链路的代码模板，以「xxx管理」为范例。参考实现：
`packages/server/src/routes/identity/users.ts`、`packages/server/src/db/schema/core.ts`。

约束条目见 [constraints.md](./constraints.md)，本文件不重复；条件性能力
（数据权限、多租户、审计 diff、附件、外呼 HTTP、懒加载、导出）见 [backend-patterns.md](./backend-patterns.md)。

---

## Step 1：数据库 Schema（`db/schema/{业务域}.ts`）

Schema 按业务域拆分（`core.ts` / `payment.ts` / `member.ts`…），由 `db/schema.ts` barrel 统一 re-export，
业务代码统一 `from '../../db/schema'` 导入。新表放入对应业务域文件（没有合适的就新建域文件并在 barrel 登记）；
`xxxRelations` 统一维护在 `db/schema/relations.ts`。

```ts
// ─── 枚举（新枚举需三端同步：pgEnum / TS union / Zod enum）───────────────
export const xxxStatusEnum = pgEnum('xxx_status', ['enabled', 'disabled']);
// 复用已有 statusEnum 时无需新建

// ─── 主表 ───────────────────────────────────────────────────────────────
// 列名由 drizzle 的 casing: 'snake_case' 自动派生（key 驼峰 → 蛇形），不写显式列名；
// 仅当派生结果与目标列名不一致时（如 wechatApiV3Key → wechat_api_v3_key 的边界情形）才显式指定。
export const xxxs = pgTable('xxxs', {
  id:          integer().primaryKey().generatedAlwaysAsIdentity(),
  name:        varchar({ length: 64 }).notNull(),
  description: text(),
  status:      statusEnum().notNull().default('enabled'),
  // 可选外键用 set null，关联表用 cascade
  parentId:    integer().references(() => xxxs.id, { onDelete: 'set null' }),
  // 审计列：created_by / updated_by → users.id，由 db Proxy 自动写入
  ...auditColumns(),
  createdAt:   timestamp().defaultNow().notNull(),
  updatedAt:   timestamp().defaultNow().$onUpdate(() => new Date()).notNull(),
});

// 主表总是导出这两个 infer 类型
export type XxxRow = typeof xxxs.$inferSelect;
export type NewXxx = typeof xxxs.$inferInsert;
```

唯一约束命名：驼峰多词列（`orderNo` 等）必须显式蛇形命名——列级 `.unique('xxxs_order_no_unique')`、
表级 `unique('xxxs_tenant_code_unique').on(t.tenantId, t.code)`；单词列（`code` / `name`）裸 `.unique()` 即可。

Step 0 确认需要租户隔离时，才按 [backend-patterns.md → 多租户隔离](./backend-patterns.md#多租户隔离tenantscope)
添加 `tenantId`；基础模板不默认调用租户工具。

多对多联结表：

```ts
export const xxxYyys = pgTable('xxx_yyys', {
  xxxId: integer().notNull().references(() => xxxs.id, { onDelete: 'cascade' }),
  yyyId: integer().notNull().references(() => yyys.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.xxxId, t.yyyId] })]);
```

关联声明写在 `db/schema/relations.ts`，否则 `db.query.xxxs` 无法识别 `with:` 中的关联字段。

## Step 2：迁移

```bash
npm run db:generate && npm run db:migrate
```

## Step 3：共享 Zod Schema（`shared/src/{业务域}/validation.ts`）

```ts
import { partialForUpdate } from '../core/validation';

export const createXxxSchema = z.object({
  name:        z.string().min(1, '名称不能为空').max(64),
  description: z.string().max(256).optional(),
  // 会被其他域 z.enum() 引用的常量数组必须放 constants.ts，此处只做引用
  status:      z.enum(XXX_STATUSES).default('enabled'),
  parentId:    z.number().int().positive().nullable().optional(),
  yyyIds:      z.array(z.number().int()).default([]),   // 多对多
});

// 部分更新一律由 partialForUpdate 派生：剥离全部 .default() 后再 partial，字段省略即「保持不变」
// 有不可更改字段时 partialForUpdate(createXxxSchema.omit({ username: true }))
export const updateXxxSchema = partialForUpdate(createXxxSchema);

export type CreateXxxInput = z.infer<typeof createXxxSchema>;
export type UpdateXxxInput = z.infer<typeof updateXxxSchema>;
```

`.default()` 只属于创建语义。禁止直接调用 `.partial()`（ESLint 封禁）：Zod 的 `.partial()` 保留 `.default()`，
字段省略时会填入默认值并被服务层 `.set({ ...data })` 写库。全量替换 / upsert 端点（如整体保存的配置表单、
按 key 覆盖的授权记录）可以带默认值，但必须在 `app.contract.test.ts` 的整体替换例外清单登记理由。

特殊操作（如重置密码）单独建 schema。

## Step 4：共享 TS Interface（`shared/src/{业务域}/types.ts`）

```ts
export interface Xxx {
  id: number;
  name: string;
  description?: string;
  status: XxxStatus;              // union type 来自同域 constants.ts
  // 关联冗余字段（JOIN 后附加，供前端直接展示）
  parentId?: number | null;
  parentName?: string | null;
  // 多对多关联
  yyys?: Yyy[];
  yyyIds?: number[];
  // 审计字段（db Proxy 自动写入，按需透出）
  createdBy?: number | null;
  updatedBy?: number | null;
  // 时间字段序列化为 YYYY-MM-DD HH:mm:ss 字符串
  createdAt: string;
  updatedAt: string;
}
```

---

## Step 5：Service 层（`services/{业务域}/xxx.service.ts`）

```ts
import { HTTPException } from 'hono/http-exception';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../db';
import { xxxs, type XxxRow } from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';

// ─── 数据映射（DB 行 → 公开字段），纯函数、无副作用 ──────────────────────
export function mapXxx(row: XxxRow) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description ?? null,
    status:      row.status,
    createdBy:   row.createdBy ?? null,
    updatedBy:   row.updatedBy ?? null,
    createdAt:   formatDateTime(row.createdAt),
    updatedAt:   formatDateTime(row.updatedAt),
  };
}

export interface ListXxxsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: XxxStatus;
  startTime?: string;
  endTime?: string;
}

interface XxxWhereInput extends ListXxxsQuery {
  id?: number;
}

// 所有读取入口共用；Step 0 启用 dataScope / tenantScope 时也把访问条件集中加在这里
async function buildXxxWhere(q: XxxWhereInput) {
  return buildWhere(
    q.id !== undefined ? eq(xxxs.id, q.id) : undefined,
    // 内部已判空并 escapeLike，调用点不要再包 if (q.keyword)
    keywordCondition(q.keyword, [xxxs.name, xxxs.description]),
    q.status ? eq(xxxs.status, q.status) : undefined,
    // 终点自动取当天 23:59:59.999，不会漏掉当天数据
    ...dateRangeConditions(xxxs.createdAt, q.startTime, q.endTime),
  );
}

export async function listXxxs(q: ListXxxsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = await buildXxxWhere(q);

  // count 与 list 相互独立，必须并行
  const [total, rows] = await Promise.all([
    db.$count(xxxs, where),
    withPagination(
      db.select().from(xxxs).where(where).orderBy(asc(xxxs.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { list: rows.map(mapXxx), total, page, pageSize };
}

export async function getXxx(id: number) {
  return mapXxx(await ensureXxxExists(id));
}

// ─── 前置校验：直接抛 HTTPException，由全局 onError 转标准 JSON ───────────
export async function ensureXxxExists(id: number) {
  const [row] = await db.select().from(xxxs).where(await buildXxxWhere({ id })).limit(1);
  if (!row) throw new HTTPException(404, { message: 'XXX 不存在' });
  return row;
}
```

更新与删除也使用 `await buildXxxWhere({ id })`；route 的前置校验不替代 service 行级隔离。

命名约定：数据映射函数 `mapXxx` 前缀，前置校验函数 `ensureXxx` 前缀。

### 关联查询优先用 RQB

```ts
// ✅ 详情：RQB 自动处理 LEFT JOIN，columns 限定取值范围
const row = await db.query.xxxs.findFirst({
  where: await buildXxxWhere({ id }),
  with: { createdByUser: { columns: { nickname: true } } },
});

// ✅ 分页列表 + 多层关联：一次拉全，不要先查主表再手工拼装 getXxxMap()
const rows = await db.query.users.findMany({
  where,
  with: {
    department:    { columns: { name: true } },
    userRoles:     { columns: {}, with: { role: true } },
    userPositions: { columns: {}, with: { position: true } },
  },
  orderBy: users.id,
  limit: pageSize,
  offset: pageOffset(page, pageSize),
});

// ❌ 手写 LEFT JOIN 仅在跨表 WHERE 过滤或聚合计数时才需要
```

### 事务与多对多写入

先 delete 再 insert 的 replace 模式若 insert 失败会丢数据，必须保证原子性；
辅助函数接受 `executor` 参数，事务内外统一调用。

```ts
import type { DbExecutor } from '../../db/types';

/** 先删后插，原子性更新 xxx 的 yyy 关联 */
async function setXxxYyys(executor: DbExecutor, xxxId: number, yyyIds: number[]): Promise<void> {
  await executor.delete(xxxYyys).where(eq(xxxYyys.xxxId, xxxId));
  if (yyyIds.length > 0) {
    await executor.insert(xxxYyys).values(yyyIds.map((yyyId) => ({ xxxId, yyyId })));
  }
}

// 创建：主表写入与关联写入同一事务
const row = await db.transaction(async (tx) => {
  const [created] = await tx.insert(xxxs).values(data).returning();
  await setXxxYyys(tx, created.id, data.yyyIds ?? []);
  return created;
});

// 独立的「分配关联」接口（不改主表）同样用事务保证 delete+insert 原子
await db.transaction(async (tx) => {
  await setXxxYyys(tx, id, data.yyyIds);
});
```

外键存在性校验：

```ts
async function ensureYyyExists(yyyId: number | null | undefined): Promise<void> {
  if (!yyyId) return;
  const [row] = await db.select({ id: yyys.id }).from(yyys).where(eq(yyys.id, yyyId));
  if (!row) throw new HTTPException(400, { message: `指定的 YYY（id=${yyyId}）不存在` });
}
```

---

## Step 6：OpenAPI Route（`routes/{业务域}/xxx.ts`）

### 先在 `lib/dtos/` 添加实体 DTO

DTO 按业务域拆分在 `lib/dtos/` 子文件中，再经 `lib/openapi-dtos.ts` 统一导出。

```ts
// packages/server/src/lib/dtos/xxxs.ts
import { auditFields } from './_audit';

export const XxxDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: z.enum(XXX_STATUSES),
    ...auditFields,          // createdBy / updatedBy
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Xxx');
```

```ts
// packages/server/src/lib/openapi-dtos.ts
export { XxxDTO } from './dtos/xxxs';
```

### 路由文件

```ts
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, BatchIdsBody, okBody, errBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import { XxxDTO } from '../../lib/openapi-dtos';
import { listXxxs, getXxx, createXxx, updateXxx, deleteXxx, ensureXxxExists } from '../../services/{业务域}/xxx.service';
import { createXxxSchema, updateXxxSchema } from '@zenith/shared/{业务域}';

// 不使用 <AuthEnv> 泛型，不添加全局 use('*', authMiddleware)
const xxxRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── GET / — 分页列表 ────────────────────────────────────────────────────
const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['XXX管理'], summary: 'XXX列表',      // tags 即 Swagger 分组，无需另行注册
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:xxx:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(XXX_STATUSES).optional(),
        // 范围端点必须校验格式，裸 z.string() 会让 ?endTime=abc 静默返回全量数据
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(XxxDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listXxxs(c.req.valid('query'))), 200),
});

// ─── GET /{id} — 详情 ────────────────────────────────────────────────────
const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['XXX管理'], summary: '获取 XXX 详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:xxx:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(XxxDTO, 'XXX 详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getXxx(id)), 200);
  },
});

// ─── POST / — 创建 ───────────────────────────────────────────────────────
const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['XXX管理'], summary: '创建 XXX',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:xxx:create',
      audit: { description: '创建 XXX', module: 'XXX管理' },
    })] as const,
    request: { body: { content: jsonContent(createXxxSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(XxxDTO, '创建成功') },
  }),
  handler: async (c) => {
    const row = await createXxx(c.req.valid('json'));
    return c.json(okBody(row, '创建成功'), 200);
  },
});

// ─── PUT /{id} — 更新 ────────────────────────────────────────────────────
const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['XXX管理'], summary: '更新 XXX',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:xxx:update',
      audit: { description: '更新 XXX', module: 'XXX管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateXxxSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(XxxDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await ensureXxxExists(id);   // 不存在时抛 HTTPException(404)
    setAuditBeforeData(c, before);              // 操作日志 diff 的变更前快照
    const row = await updateXxx(id, c.req.valid('json'));
    return c.json(okBody(row, '更新成功'), 200);
  },
});

// ─── DELETE /{id} — 删除 ─────────────────────────────────────────────────
const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['XXX管理'], summary: '删除 XXX',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:xxx:delete',
      audit: { description: '删除 XXX', module: 'XXX管理' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureXxxExists(id));
    await deleteXxx(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// 路由注册与 export 见下方「最终注册顺序」
```

### 下拉源（前端启用 `lookup: true` 时）

先在 service 添加：

```ts
export async function listAllXxxs() {
  // 必须复用列表的访问边界；否则 /all 会绕过 dataScope / tenantScope
  const where = await buildXxxWhere({ status: 'enabled' });
  const rows = await db.select().from(xxxs)
    .where(where)
    .orderBy(asc(xxxs.id));
  return rows.map(mapXxx);
}
```

再添加静态路由：

```ts
const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['XXX管理'], summary: '全部启用 XXX（供下拉框）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:xxx:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(XxxDTO), '全部 XXX') },
  }),
  handler: async (c) => c.json(okBody(await listAllXxxs()), 200),
});

```

同步从 service 导入 `listAllXxxs`。若 Step 0 未确认需要下拉源，不实现该端点，前端也不要开启 `lookup`；
启用 Demo 模式时再同步添加 Mock `/all`。

### 批量删除（Step 0 确认需要时）

仅用于用户已选中、可在正常 HTTP 请求窗口内快速完成的有界操作。
大数据量、长耗时或需要进度 / 重试 / 取消的批处理改用[任务中心](./async-tasks.md)。
`DELETE /batch` 必须注册在 `DELETE /{id}` **之前**，否则 `/batch` 被匹配为 `id = "batch"`。

先在 service 添加同样受行级权限约束的批量删除（并从 `drizzle-orm` 导入 `inArray`）：

```ts
export async function deleteXxxs(ids: number[]) {
  const where = buildWhere(
    inArray(xxxs.id, ids),
    await buildXxxWhere({}),   // 复用 dataScope / tenantScope
  );
  const deleted = await db.delete(xxxs).where(where).returning({ id: xxxs.id });
  return deleted.length;
}
```

路由同步导入 `deleteXxxs`：

```ts
const batchDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch',
    tags: ['XXX管理'], summary: '批量删除 XXX',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:xxx:delete',
      audit: { description: '批量删除 XXX', module: 'XXX管理' },
    })] as const,
    request: { body: { content: jsonContent(BatchIdsBody), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('批量删除成功') },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    if (!ids?.length) return c.json(errBody('请选择要删除的记录'), 400);
    const deleted = await deleteXxxs(ids);
    return c.json(okBody(null, `已删除 ${deleted} 条记录`), 200);
  },
});
```

### 最终注册顺序

路由文件只调用**一次** `openapiRoutes()`，放在 `export default` 之前；按实际启用项取消注释：

```ts
xxxRouter.openapiRoutes([
  listRoute,
  // allRoute,             // 启用 lookup 时；静态 /all 早于动态 /{id}
  // batchDeleteRoute,     // 启用同步批量删除时；静态 /batch 早于动态 /{id}
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default xxxRouter;
```

---

## Step 7：注册路由（`routes/{业务域}/index.ts`）

各业务域 barrel 声明挂载清单，`routes/index.ts` 只声明域顺序。

```ts
import { defineRouteDomain } from '../_kit';
import xxxRoutes from './xxx';                 // ← 新增 import

export default defineRouteDomain({
  name: '{业务域}',
  mounts: () => [
    // …既有挂载保持原样
    ['/api/xxxs', xxxRoutes],                  // ← 新增挂载
  ],
});
```

- **数组顺序即挂载顺序**：同一路径被多次挂载时顺序是语义的一部分，不要改动既有条目的相对位置
- WS 路由需要 `upgradeWebSocket` 时，把 `mounts` 写成 `(ctx) => [...]`，用 `ctx.upgradeWebSocket`
- 需要在**全部** API 路由之后兜底的挂载（如按 Host 匹配的 `/`）必须放进 `fallback` 而不是 `mounts` 末尾
- 新增业务域：建 `routes/{业务域}/index.ts`，再加进 `routes/index.ts` 的 `ROUTE_DOMAINS`

OpenAPI spec 无需手工维护，`@hono/zod-openapi` 从每个 `createRoute()` 自动汇总到 `/api/openapi.json`。
挂载后执行 `npm run dev:server`，刷新 <http://localhost:3300/api/docs> 确认新接口出现。
