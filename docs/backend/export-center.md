# 导出中心

导出中心将后台业务导出统一收口到 `/api/export-jobs` 与 `packages/server/src/lib/export-center/`。业务列表页不新增模块私有导出下载端点，前端通过 `ExportButton` 传入实体编码、导出格式与当前筛选条件。

## 能力范围

- **四种格式**：`xlsx` / `csv` / `pdf` / `docx`（`EXPORT_JOB_FORMATS`，定义在 `@zenith/shared/tasks`）。实体通过 `formats` 声明开放哪些格式，默认 `['xlsx', 'csv']`；pdf / docx 需实体自行提供 `renderFile()` 渲染（如报表打印导出）。
- **三种渲染模式**（`renderMode`）：
  - `table`（默认）— 标准表格，支持多级表头、合并单元格、列宽、表头/单元格样式、标题行、元信息行与冻结表头
  - `layout` — 多工作表复杂布局（`layout.sheets` 声明）
  - `custom` — 通过 `renderWorkbook()` 直接操作 ExcelJS Workbook，或通过 `renderFile()` 返回任意格式文件
- CSV 只输出表格叶子列，不承载合并单元格、样式和复杂布局；**只有 `renderMode: 'table'` 的实体允许 CSV**，否则创建任务时返回 400「仅支持 Excel」。
- **安全默认脱敏导出**：创建任务时 `raw` 缺省为 `false`（`masked = !raw`），敏感列按数据脱敏中心规则打码后输出；明文导出需显式传 `raw=true`。
- **同步 / 异步执行**：实体 `execution` 策略默认 `mode: 'sync'`、`syncMaxRows: 5000`。`auto` 模式按行数自动分流（不超过 `syncMaxRows` 走同步，否则异步）；异步任务进入 pg-boss `export-jobs` 队列，由服务启动时（`src/bootstrap/workers.ts` 的 `registerExportJobWorker()`）注册的 Worker 消费。
- Excel 文件默认写入隐藏的「导出信息」工作表，记录任务号、实体、模块、导出人、导出时间、筛选条件、字段范围、是否明文等信息。
- 所有导出都会生成任务记录，导出文件经 `saveGeneratedManagedFile()` 存入 `managed_files`；完成后回写真实行数 `rowCount`。同步导出成功后前端立即下载，异步导出在导出中心查看进度并下载。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/export-jobs/entities` | 查询当前用户可导出的实体与字段元数据 |
| `POST` | `/api/export-jobs` | 创建导出任务，支持 `format`、`query`、`columns`、`raw`、`watermark`、`executionMode` |
| `GET` | `/api/export-jobs` | 导出任务分页列表，普通用户只看自己的任务 |
| `GET` | `/api/export-jobs/{id}` | 导出任务详情 |
| `GET` | `/api/export-jobs/{id}/download` | 下载成功状态的导出文件，并记录下载日志 |
| `GET` | `/api/export-jobs/{id}/downloads` | 查看任务下载日志 |
| `POST` | `/api/export-jobs/{id}/cancel` | 取消待执行或执行中的异步任务 |
| `POST` | `/api/export-jobs/{id}/retry` | 重试失败任务 |
| `DELETE` | `/api/export-jobs/{id}` | 删除导出任务记录 |

## 权限与可见范围

- 每个导出实体必须声明 `permissions.export`，用于控制是否可以发起该实体导出。
- 明文导出（`raw=true`）：实体声明 `requireExportRawPermission: true` 时，还需通过 `permissions.exportRaw` 权限校验，否则返回 403「无明文导出权限」。
- 任务可见范围三级递进：
  - 普通用户只能查看和下载自己创建的导出任务
  - 拥有 `system:export-job:tenant-manage` 的用户可查看本租户全部导出任务
  - 超级管理员或拥有 `system:export-job:manage` 的用户可查看全部导出任务

## 敏感列与数据脱敏

列声明 `sensitive: true` 标记敏感字段；实体含敏感列时任务记为 `sensitive`，留存策略取 `sensitiveDays`。脱敏导出（`masked=true`）执行时会预加载数据脱敏中心的规则映射（`getExportMaskRuleMap()`），敏感列按 `maskEntity` / `maskField` 匹配规则打码，未命中规则时按字段名回退到内置脱敏类型。

## 留存与清理

导出文件按实体定义的 `retention` 策略计算 `expiresAt`：

| 类型 | 默认留存 |
| --- | --- |
| 普通导出 | 7 天 |
| 敏感字段导出 | 3 天 |
| 明文导出 | 1 天 |

`raw=true` 时优先使用明文留存天数。过期文件由系统级周期任务 `export-file-cleanup`（cron `0 3 * * *`，每天 03:00）自动清理；该任务在 `src/lib/system-tasks.registry.ts` 的 `registerSystemTasks()` 中通过 `registerSystemRecurringJob()` 注册，展示在「系统调度」页并支持手动执行，不出现在业务「定时任务」列表。清理时会删除存储文件和 `managed_files` 记录，并将导出任务标记为 `expired`，保留任务记录与下载日志用于审计。

## 后端接入

在 `packages/server/src/lib/export-center/definitions/` 新增实体定义，并在 `definitions/index.ts` 中 import 后加入注册数组。以下为真实定义（`definitions/positions.ts`）：

```ts
import { asc } from 'drizzle-orm';
import { db } from '../../../db';
import { positions } from '../../../db/schema';
import { currentUser } from '../../context';
import { tenantCondition } from '../../tenant';
import { defineExport } from '../registry';
import { COMMON_STATUS_LABELS } from '@zenith/shared/core';
import type { ExportColumn } from '../types';

const columns: ExportColumn[] = [
  { key: 'id', header: 'ID', width: 8, type: 'number' },
  { key: 'name', header: '岗位名称', width: 18 },
  { key: 'code', header: '岗位编码', width: 18 },
  { key: 'status', header: '状态', width: 10, enumMap: COMMON_STATUS_LABELS },
  { key: 'createdAt', header: '创建时间', width: 22, type: 'datetime' },
];

export const positionsExportDefinition = defineExport({
  entity: 'system.positions',
  moduleName: '岗位管理',
  filenamePrefix: '岗位列表',
  sourcePath: '/system/positions',
  sheetName: '岗位列表',
  permissions: { export: 'system:position:list' },
  execution: { mode: 'sync', syncModeOverridesAsyncPolicies: true },
  retention: { normalDays: 7, sensitiveDays: 7, rawDays: 7 },
  columns,
  countRows: async () => db.$count(positions, tenantCondition(positions, currentUser())),
  streamRows: async () =>
    db.select().from(positions).where(tenantCondition(positions, currentUser())).orderBy(asc(positions.sort)),
});
```

定义要点：

- `columns` 支持多级 `children`（自动渲染为合并表头）、`enumMap` 枚举映射、`transform` 值转换、`sensitive` / `maskEntity` / `maskField` 脱敏标记；字段级样式用 `style` / `headerStyle`，全局样式用 `styles.title` / `styles.meta` / `styles.header` / `styles.body`
- `streamRows` 可返回数组、Iterable 或 async generator（大数据量导出用 generator 流式产出，配合 `cursor-stream.ts` 游标分批查询）
- `resolveColumns(query, user)` 是可选的动态列钩子，用于列结构运行时才能确定的导出（如报表数据集），提供后渲染时替代静态 `columns`
- `execution` / `retention` 均为部分覆盖，未声明的字段落回默认值（`DEFAULT_EXPORT_EXECUTION`：`mode: 'sync'`、`syncMaxRows: 5000`、`forceAsyncWhenRaw: false`、`forceAsyncWhenSensitive: false`、`syncModeOverridesAsyncPolicies: true`）
- 高度定制场景：`renderMode: 'custom'` + `renderWorkbook()`（自定义 Excel）或 `renderFile()`（pdf / docx 等任意格式，返回 `{ buffer, mimeType, filename?, rowCount? }`），参考 `definitions/report-print.ts`
- 导出执行时框架已用 `runWithCurrentUser(创建者)` 还原身份，`countRows` / `streamRows` 内可直接使用 `currentUser()` 与租户过滤

## 前端接入

列表页统一使用 `ExportButton` 组件，默认 `formats={['xlsx', 'csv']}`、`raw=false`（脱敏导出）、`watermark=true`、`executionMode='sync'`：

```tsx
function buildExportQuery(): Record<string, unknown> {
  // 使用当前已提交的筛选条件（submittedParams），与列表查询保持一致
  return {
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
  };
}

const renderExportButtons = () => hasPermission('system:xxx:export') ? (
  <ExportButton entity="system.xxxs" query={buildExportQuery()} />
) : null;
```

同步导出成功后会自动调用 `/api/export-jobs/{id}/download` 下载文件；异步导出会提示用户到导出中心查看任务进度。明文导出需显式传 `raw`，且用户需具备对应的 `exportRaw` 权限。
