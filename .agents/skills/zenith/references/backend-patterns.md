# 后端条件性与横切能力

Step 1-7 主链路之外、按需接入的后端能力。约束条目见 [constraints.md](./constraints.md)。

| 能力 | 何时读 |
| --- | --- |
| [数据权限过滤（dataScope）](#数据权限过滤datascope) | Step 0 确认需要按部门隔离可见范围 |
| [多租户隔离（tenantScope）](#多租户隔离tenantscope) | Step 0 确认需要租户隔离 |
| [操作日志变更 diff](#操作日志变更-diff) | 写接口需在操作日志中展示变更前后快照 |
| [业务附件](#业务附件business_files) | 模块需要上传 / 展示附件 |
| [数据导出](#数据导出导出中心) | Step 0 确认需要导出 Excel / CSV |
| [外呼 HTTP 调用](#外呼-http-调用) | 需要调用第三方接口 |
| [重型依赖懒加载](#重型依赖懒加载) | 引入体积大或加载慢的 SDK |

---

## 数据权限过滤（dataScope）

仅业务数据模块需要；配置数据（角色 / 菜单 / 字典）无需过滤。

### 前提：业务表有 `department_id`

```ts
export const xxxs = pgTable('xxxs', {
  // ...其他字段
  departmentId: integer('department_id').references(() => departments.id),
});
```

`department_id` 在创建时从创建人部门写入，之后**不跟随人员调岗变动**。
过滤逻辑是 `WHERE data.department_id IN (我的部门及子部门)`，而非反查创建人当前部门。

### 列表查询追加 scopeCondition

```ts
import { getDataScopeCondition } from '../../lib/data-scope';
import { buildWhere, keywordCondition } from '../../lib/where-helpers';

// 写在 service 的列表函数中（薄路由约定：route handler 不碰 db 与查询条件）
const scopeCondition = await getDataScopeCondition({
  currentUserId: currentUser().userId,
  deptColumn:  xxxs.departmentId,   // 目标表的 department_id 列
  ownerColumn: xxxs.id,             // 用于 self 过滤的主键列
});

const where = buildWhere(
  keywordCondition(q.keyword, [xxxs.name]),
  scopeCondition,                   // 无限制时为 undefined，buildWhere 自动忽略
  tenantCondition(xxxs, currentUser()),
);
```

### 创建时写入部门

```ts
const [creator] = await db.select({ departmentId: users.departmentId })
  .from(users).where(eq(users.id, currentUser().userId)).limit(1);

await db.insert(xxxs).values({ ...data, departmentId: creator?.departmentId ?? null });
```

### dataScope 取值

| 值 | 含义 | 可见范围 |
| --- | --- | --- |
| `all` | 全部数据 | 所有记录（不过滤） |
| `dept` | 本部门 | 与当前用户同 `department_id` 的记录 |
| `self` | 仅本人 | 由 `ownerColumn = currentUserId` 标识的记录 |

---

## 多租户隔离（tenantScope）

仅当 `MULTI_TENANT_MODE=true` 时生效；关闭时两个工具函数均返回 `undefined` / `null`，与单实例行为兼容。

```ts
// Step 1：Schema
export const xxxs = pgTable('xxxs', {
  // ...其他字段
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
});
```

```ts
// Step 5：Service
import { tenantCondition, getCreateTenantId } from '../../lib/tenant';
import { buildWhere } from '../../lib/where-helpers';
import { currentUser } from '../../lib/context';

const where = buildWhere(
  keywordCondition(q.keyword, [xxxs.name]),
  tenantCondition(xxxs, currentUser()),
);

await db.insert(xxxs).values({ ...data, tenantId: getCreateTenantId(currentUser()) });
```

- `tenantCondition` 在多租户关闭时返回 `undefined`，**无需**额外判断是否开启——交给 `buildWhere` / `mergeWhere` 过滤
- 平台超管处于「平台视角」时同样返回 `undefined`，可查看全量数据
- `getCreateTenantId` 在多租户关闭时返回 `null`，不影响写入

---

## 操作日志变更 diff

操作日志可记录实体的**操作前 / 后快照**，在日志详情弹窗中以表格 diff 展示变更字段。

| 层 | 位置 | 职责 |
| --- | --- | --- |
| DB | `operation_logs.before_data` / `after_data` | 存储 JSON 快照字符串 |
| 中间件 | `middleware/guard.ts` | 自动从响应体提取 `afterData`；提供 `setAuditBeforeData()` / `setAuditAfterData()` |
| 路由 | 需要 diff 的 PUT / DELETE / 分配类路由 | 注入快照 |
| 前端 | `OperationLogsPage.tsx → DiffTable` | 解析、比对、高亮变更行（无需改动） |

### 常规写接口

写操作**前**注入变更前快照，`guard` 会在 `next()` 后从 `{ code: 0, data: ... }` 响应体自动提取变更后快照：

```ts
import { guard, setAuditBeforeData } from '../../middleware/guard';

const before = await ensureXxxExists(id);
// 有敏感字段时先排除
const { password: _pwd, ...safeBefore } = before;
setAuditBeforeData(c, safeBefore);
```

DELETE 的 `afterData` 通常为 null（响应 `data` 为 null），前端 diff 仅展示变更前列，属预期行为。

### 响应 `data=null` 的分配类接口

成员分配、角色 / 菜单权限分配、数据权限设置等接口返回 `okBody(null, '保存成功')`，
只设 `beforeData` 会导致 diff 缺少变更后快照，**必须**在写操作后补 `setAuditAfterData`：

```ts
handler: async (c) => {
  const { id } = c.req.valid('param');
  const { userIds } = c.req.valid('json');

  setAuditBeforeData(c, await getXxxMembersBeforeAudit(id));
  await setXxxMembers(id, userIds);
  setAuditAfterData(c, await getXxxMembersBeforeAudit(id));

  return c.json(okBody(null, '保存成功'), 200);
},
```

快照 helper 命名为 `getXxxMembersBeforeAudit()` / `getXxxPermissionBeforeAudit()`；
返回主实体标识 + 关联 id 数组 + 轻量展示字段，避免把敏感字段或超大对象写进日志。

---

## 业务附件（`business_files`）

模块需要上传附件（公告、通知、工单等）时，复用系统统一的多态关联表，不要新建模块专属附件表。

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| DB | `business_files` | 通用业务文件关联表（多态） |
| DB | `managed_files` | 文件元数据表（`id` 为 UUIDv7 字符串） |
| 枚举 | `business_type`（pgEnum，`db/schema/files.ts`） | 业务类型 |
| Service | `services/files/business-files.service.ts` | 通用附件 CRUD |
| 前端 | `components/FileAttachment` | 上传 / 预览 / 下载（内部已处理鉴权） |

### 1. 注册业务类型

```ts
// packages/server/src/db/schema/files.ts
export const businessTypeEnum = pgEnum('business_type', ['announcement', 'notice', /* 新增 */]);
```

```bash
npm run db:generate && npm run db:migrate
```

同步在 `shared/src/{业务域}/constants.ts` 追加常量数组与派生 union type。

### 2. Shared 层

```ts
// types.ts
export interface NoticeAttachment {
  id: number;
  fileId: string;                 // managed_files.id（UUIDv7 字符串）
  businessType: 'notice';
  businessId: number;
  file: {
    id: string; originalName: string; size: number;
    mimeType: string | null; extension: string | null; url: string;
  };
  sortOrder: number;
  createdAt: string;
}

// validation.ts
export const createNoticeSchema = z.object({
  // ...其他字段
  fileIds: z.array(z.string().uuid()).optional().default([]),
});
```

### 3. Service：写入时保存关联

```ts
import { saveBusinessFiles, listBusinessFiles } from '../../services/files/business-files.service';

export async function createNotice(data: CreateNoticeInput) {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(notices).values({ ... }).returning();
    if (data.fileIds?.length) await saveBusinessFiles(tx, 'notice', created.id, data.fileIds);
    return mapNotice(created);
  });
}

export async function updateNotice(id: number, data: UpdateNoticeInput) {
  return db.transaction(async (tx) => {
    await tx.update(notices).set({ ... }).where(eq(notices.id, id));
    // 传了 fileIds 才替换关联（先删后插）
    if (data.fileIds !== undefined) await saveBusinessFiles(tx, 'notice', id, data.fileIds);
    return getNoticeDetail(id);
  });
}
```

### 4. 详情接口直接返回附件

标准做法是详情一次性带出附件，前端无需二次加载：

```ts
export async function getNoticeDetail(id: number) {
  const user = currentUser();
  const [row] = await db.select().from(notices).where(eq(notices.id, id));
  if (!row) throw new HTTPException(404, { message: '通知不存在' });

  const [recipients, attachments] = await Promise.all([
    listNoticeRecipients(id),
    listBusinessFiles('notice', id, { tenant: tenantCondition(businessFiles, user) }),
  ]);
  return { ...mapNotice(row), recipients, attachments };
}
```

DTO 定义在 `lib/dtos/notices.ts` 并从 `lib/openapi-dtos.ts` 导出，与其他实体 DTO 一致。

### 5. 前端

```tsx
import FileAttachment from '@/components/FileAttachment';

// 编辑
<FileAttachment mode="edit" value={attachments} onChange={setAttachments}
  title="附件" limit={10} maxSizeMB={50} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />

// 查看
<FileAttachment mode="view" value={notice?.attachments} title="附件" />

// 提交时提取 fileIds
const payload = { ...values, fileIds: attachments.map((a) => a.fileId) };
```

- `fileId` / `fileIds` 一律按 UUIDv7 **字符串**处理，禁止当作数字 ID
- 文件内容 URL 为 `/api/files/{id}/content`
- 页面自行预览 / 下载时用 `fetchProtectedFile(url)` 取 Blob 再创建 object URL；
  需要新窗口打开时先拉 Blob 再打开 object URL

参考实现：`routes/messaging/announcements.ts`、`services/files/business-files.service.ts`、
`components/FileAttachment/index.tsx`、`utils/file-utils.tsx`。

---

## 数据导出（导出中心）

- 后端在 `lib/export-center/definitions/` 新增 `defineExport` 实体定义，并在 `definitions/index.ts` 注册
- 导出字段、Excel / CSV 格式、权限、同步 / 异步策略、文件留存、合并表头与自定义样式全部写在实体定义中
- 前端统一用 `ExportButton`，`entity` 指定实体编码，`query` 传当前**已提交**的筛选条件
  （`submittedParams`，与列表查询保持一致）
- 列表页默认同步明文导出；大数据或敏感场景由实体定义的 `execution` 策略调整

---

## 外呼 HTTP 调用

服务端**所有**对外 HTTP 请求必须通过 `lib/http-client.ts`，禁止全局 `fetch()`。

```ts
import { httpGet, httpPost, HttpClientError } from '../../lib/http-client';

const resp = await httpGet('https://api.example.com/users', { headers: { Authorization: token } });
if (!resp.ok) throw new HttpClientError('上游返回非 2xx', { status: resp.status, url: resp.url });
const data = await resp.json<{ id: number; name: string }>();

// POST JSON：对象自动 stringify 并补 Content-Type
await httpPost('https://api.example.com/users', { name: 'Alice' });
```

| 参数 | 默认 | 何时设置 |
| --- | --- | --- |
| `timeout` | `0`（无超时） | 调用不可控的第三方接口，建议 `5000`–`10000` |
| `retries` | `0` | 上游偶发 5xx / 网络抖动，设 `1`–`3` |
| `retryDelay` | `300`（ms 基准） | 指数退避起点，通常无需改 |
| `proxy` | 无 | **仅由代码显式传入**，不读环境变量 |
| `baseURL` | 无 | url 为相对路径时拼接前缀 |
| `signal` | 无 | 与外部 `AbortController` 协作 |

失败统一抛 `HttpClientError`（含 `url` / `headers` / `bodySnippet` / `cause`）：
`status === 0` 为网络错误 / 熔断 / 超时，`status > 0` 为上游非 2xx。

```ts
try {
  await httpGet(url);
} catch (err) {
  if (err instanceof HttpClientError && err.status === 0) {
    throw new HTTPException(502, { message: '上游服务不可用' });
  }
  throw err;
}
```

无需调用方关心的内置能力：按 host 熔断（连续 5 次失败开启 30s 冷却）、敏感 Header 日志脱敏、
完整 winston 结构化日志。详细 API 见 [docs/backend/http-client.md](../../../../docs/backend/http-client.md)。

---

## 重型依赖懒加载

禁用清单与判定规则见 [constraints.md → 重型依赖懒加载](./constraints.md#重型依赖懒加载server)。写法：

```ts
import { createRequire } from 'node:module';
import type ExcelJS from 'exceljs';                    // 类型引用：编译期擦除

// require() 返回 CJS module.exports 原对象，dev(tsx) 与 prod(node dist) 语义一致
const require = createRequire(import.meta.url);
const loadExcelJS = () => require('exceljs') as typeof import('exceljs');

export async function exportXxx(): Promise<ArrayBuffer> {
  const workbook = new (loadExcelJS().Workbook)();     // 使用时才触发加载
  // ...
}
```

- 类型位置照常 `ExcelJS.Row` / `ExcelJS.Worksheet`（走 `import type`），值位置一律经 `loadXxx()`
- Node 有模块缓存，无需自建缓存
- 命名导出解构取用：`const { GetObjectCommand } = loadS3();`（参考 `lib/file-storage.ts`）
- 双格式包（如 `sharp`）的 `typeof import('pkg')` 可能解析到 ESM 声明（default 导出）而 require 拿到
  CJS 可调用对象，需 `as unknown as typeof import('pkg')['default']` 匹配运行时形状
  （参考 `services/cms/cms-image.service.ts`）
- 参考实现：`lib/file-storage.ts`（7 个云 SDK）、`lib/sms-sender.ts`、`lib/report-external-db.ts`、
  `lib/telemetry.ts`（async 场景用动态 `import()`）、`services/ops/docker.service.ts`
