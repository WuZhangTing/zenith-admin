# CRUD 前端实现参考（以「xxx管理」为范例）

本文档提供前端页面的完整代码模板，对照 `packages/web/src/pages/system/tenant-packages/TenantPackagesPage.tsx`（标准列表页）与 `packages/web/src/pages/users/UsersPage.tsx`（复杂页面）的实际实现。

> **占位符约定**：`xxx` = 小写（表名、API 路径、文件名）；`Xxx` = 大驼峰（TypeScript 类型、组件名）；替换时请将所有 `xxx`/`Xxx` 替换为实际实体名。

---

## 数据获取架构（必读）

前端服务端状态统一由 **TanStack Query v5** 管理，分两层：

- **传输层**：`packages/web/src/utils/request.ts`（token 刷新、401/429/503、错误 Toast）。**禁止**在页面里手写 `loading`/`data` state + `fetchXxx` useCallback + `useEffect` 初始拉取的旧模式。
- **服务端状态层**：`packages/web/src/hooks/queries/<域>.ts` 域 hooks 文件 + 页面内 `useQuery`/`useMutation`。基建位于 `packages/web/src/lib/query.ts`（`queryClient`、`unwrap()`、`toQueryString()`、`LOOKUP_STALE_TIME`）。

核心约定：

1. queryFn 统一 `request.get<T>(url).then(unwrap)`；`unwrap` 在 `code !== 0` 时抛 `ApiError`（request 层已自动 Toast，调用方无需重复提示）。
2. 每个域文件导出 keys 常量对象，必须包含 `all` / `lists` / `list(params)` / `detail(id)`；key 的树形结构按下方[「key 结构设计」](#key-结构设计)约束。
3. 分页列表查询必须 `placeholderData: keepPreviousData`（翻页不闪白屏）。
4. **查询/重置必回源**：列表页统一用 `useListSearch`（`hooks/useListSearch.ts`），它把
   draft/submitted 双状态、页码重置与 `invalidateQueries` 焊在一处。**禁止**手写这三件套——
   条件未变化时 query key 不变，不失效则 staleTime 内不发请求，而本系统「查询」按钮兼具刷新语义；
   手抄样板漏掉失效时不报错、列表仍有数据，几乎不可能被发现。详见下方[「搜索参数与分页联动」](#搜索参数与分页联动)。
5. **mutation 按副作用精确失效**，`onSuccess` 只碰真正受影响的 key；成功 Toast 留在页面代码。判据是「**有没有已挂载的查询读了这次被改动的状态**」，而不是接口像不像命令。详见下方[「缓存一致性契约」](#缓存一致性契约必读)。
6. 下拉源等低频 lookup 数据用 `staleTime: LOOKUP_STALE_TIME`（5 分钟），全局共享缓存；已有共享 lookup 直接 import，**禁止重复定义**，也禁止用本域 key 请求别域资源。详见下方[「下拉源必须归属所有者域」](#下拉源必须归属所有者域)。
7. 轮询页面用 `refetchInterval`（毫秒），禁止手写 `setInterval` 拉数据。
8. 一次性动作（文件下载 `request.download`、验密、诊断类）可保留直接调用；WebSocket / SSE / xterm 流式逻辑不走 TanStack Query。

---

## 缓存一致性契约（必读）

`invalidateQueries` 会把所有匹配 key 标脏，但**默认只立即重拉活跃（已挂载）的查询**
（query-core：`type: refetchType ?? type ?? 'active'`）。由此得出两条推论：

- 失效一个**未挂载**的缓存代价接近零，只是标脏，等下次挂载再回源 —— 该失效就失效，不要因为「怕多发请求」而漏掉；
- 真正的浪费是失效那些**与本次改动无关、却正好同屏挂载**的查询（尤其是 5 分钟 staleTime 的 lookup）。

因此 `xxxKeys.all` 不是默认选项：它会把同根下的详情、统计、日志、下拉源一并打掉。

### 按 mutation 的副作用选择策略

| mutation 形态 | 策略 |
| --- | --- |
| 更新，且写接口与详情接口**同源**（服务端同一个 `mapXxx`） | `setQueryData(detail(id), saved)` 回填 + 失效 `lists` |
| 更新，但接口返回 `okBody(null, msg)` 或只返回局部字段 | 失效 `detail(id)` + `lists` |
| 新增 | 失效 `lists` + 受影响的计数/下拉源 |
| 删除 | `removeQueries(detail(id))` + 失效 `lists` + 受影响的下拉源 |
| 子资源写入（成员 / 权限 / 菜单） | 失效该子键；**若列表渲染了该子资源的派生列（如 `userCount`），仍须失效 `lists`** |
| 命令 / 动作（执行、重跑、发布） | 按**真实副作用**失效；只有确认没有任何已挂载查询读取被改状态时才可不失效 |
| 批量覆盖、切租户、全量导入 | 允许 `.all`，但必须在代码注释里写明理由 |

### 落地要求

- **一律替换而非追加**：`xxxKeys.all` 是 `xxxKeys.detail(id)` 的前缀，写成 `.all` 后再补 `.detail(id)` 属于空转。
- **删除用 `removeQueries` 而非 `invalidateQueries`**：实体已不存在，失效会让仍缓存的详情去请求一个必然 404 的资源。
- **回填前先确认数据形状与可见性**：只有写接口与详情接口同源（服务端同一个 `mapXxx`）时才能 `setQueryData`。以下四种情况**必须**改为失效 `detail(id)`：
  - 详情接口按查看者**脱敏**：用户域写接口返回 `mapUser`（明文），详情走 `mapUserWithMask`（按角色脱敏），回填会把未脱敏的手机号/邮箱写进本不该展示它们的界面；
  - 详情比写接口**多出关联数据**：如公告的收件人、附件；
  - 写接口**不回传**表单编辑过的关联字段：如角色写接口不带 `menuIds`，回填会清空菜单勾选；
  - 列表/树额外注入了**聚合字段**：如部门树、`userCount` / `userPreview`，那是列表独有的，不要拿写接口响应覆盖列表缓存。
- **改完必须过一遍消费页面**：确认没有依赖广播失效才会刷新的列或面板。欠失效（陈旧 UI）比多失效更危险。
- **本条约束只针对 mutation 的 `onSuccess`**，与上面第 4 条「查询/重置必回源」互不冲突。

### key 结构设计

key 的树形结构直接决定失效的连坐面，按「哪些数据应当被同一个意图一起打掉」分组：

- **`all` 只能是本域自己的根**：写 `['report','dashboards']`，不是 `['report']`。`all` 若指向整个业务大域的根，域内任何一次广播都会波及同域其余十几个 key factory。
- **独立生命周期的子资源另起命名空间**：群成员写成 `['chat','group-members',id]`，而不是 `['chat','conversations',id,'members']` —— 后者会让「刷新会话列表」因前缀匹配连带打掉每个会话的成员名单。只有确实随父实体一起失效的子资源才嵌套。
- **为「意图」导出前缀键**：同一实体存在多变体查询时，用前缀键让一次调用精确覆盖整组，如 `detailOf(id)`（覆盖 auto / draft / published 三种模式的详情）、`dataOf(id)`（某看板的全部取数）、`lookupPrefix`（本域全部下拉源）。既免于在 `onSuccess` 里逐个列举变体，也免于为图省事退回 `.all`。
- **静态 lookup 与高频写入的数据分处不同前缀**：`staleTime: LOOKUP_STALE_TIME` 的下拉源、数据库元数据（表/字段）、组织架构等长期挂载，一旦与列表同根就会被每次增删改打回源。
- **昂贵的派生查询单独成键**：一屏可扇出数十个数据集请求的看板取数、答卷聚合分析（stats / cross / trend）等，不可与列表共享前缀。

### 下拉源必须归属所有者域

**禁止**用本域的 key 去拉别的域的资源（例如以 `announcementKeys.recipientOptions` 为键请求 `/api/roles/all`）。这类「藏键」在所有者域（角色）增删改时没有任何来源会失效它，界面会静默显示旧列表。

一律复用所有者域导出的共享 lookup hook（`useAllRoles` / `useFlatDepartments` / `useAllUsers` / `useAllPositions` / `useDictItems` 等）；需要组合成特定选项结构时，在本域 hook 里对这些 query 的结果做 `useMemo` 派生，而不是另起一份请求。

### 测试要求

域 hooks 的行为测试用 `packages/web/src/test-utils/query-harness.ts`，断言必须落在**可观测行为**上：
实际请求数（`ApiRecorder`）、真正进入 fetching 的查询（`observeFetches`）、缓存内容与新鲜度
（`getCacheEntry` / `isFresh` / `hasCacheEntry`）。

**禁止**只 spy「调用了 `invalidateQueries(某个 key)`」—— 这类断言在「冗余的广播写法」和
「被改坏的精确写法」两种情况下都会通过，等于没测。

参考实现：`hooks/queries/positions.ts`（回填 + 子资源）与 `hooks/queries/cron-jobs.ts`
（命令型副作用 + 静态 lookup 保护），对应测试同名 `.test.tsx`。

---

## 文件位置

```text
packages/web/src/hooks/queries/xxxs.ts     # 域 hooks（查询 + 变更）
packages/web/src/pages/xxx/XxxPage.tsx     # 页面组件
```

---

## 域 hooks 文件模板（hooks/queries/xxxs.ts）

标准五件套（key 工厂 / 列表 / 详情 / 保存 / 删除 / 下拉源）一律由 `createCrudQueries` 生成，
**不要**手抄下面这些形状——手抄漏掉的往往不是行数而是失效契约（保存后没失效 `lists`、
删除后没 `removeQueries(detail)`），这两种缺陷都不报错。

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Xxx } from '@zenith/shared/{业务域}';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface XxxListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  // 时间范围筛选：只放 formatDateTimeRangeForApi 转换后的字符串，禁止 Date 对象进 params
  // startTime?: string;
  // endTime?: string;
}

/** 下拉源通常只返回精简字段，与实体类型分开声明 */
export interface XxxOption {
  id: number;
  name: string;
}

export const {
  keys: xxxKeys,
  useList: useXxxList,
  useDetail: useXxxDetail,
  useSave: useSaveXxx,
  useDelete: useDeleteXxxs,
  useLookup: useAllXxxs,
} = createCrudQueries<Xxx, XxxListParams, Partial<Xxx>, XxxOption>({
  resource: 'xxxs',          // 同时作为 query key 前缀与默认路径 /api/xxxs
  lookup: true,              // 需要 /api/xxxs/all 下拉源时开启；子路径不同时传字符串
  // path: '/api/cms/links', // 接口路径与资源名不一致时覆盖
  // deleteMode: 'single',   // 后端没有 /batch 时；多条删除退化为并发单条
  // keyPrefix: ['workflow', 'automations'], // 仅迁移存量域：原本用嵌套 key 且有跨域
  //                                         // invalidateQueries({ queryKey: ['workflow'] })
  //                                         // 依赖该前缀时，保留它，否则本域会悄悄脱离原失效范围
  // onSaved: (qc) => invalidateCurrentUserAccess(qc), // 跨域联动的额外失效
});
```

工厂已覆盖的失效契约：保存后失效 `detail(id)` + `lists` +（若启用）`lookup`；
删除后 `removeQueries(detail(id))` + 失效 `lists` +（若启用）`lookup`。

**非标准接口继续手写**，用工厂导出的 `keys` 做失效，并注释说明为何只失效这些：

```ts
/** 分配菜单：menuIds 只存在于详情，列表与下拉源都不含，故不失效它们 */
export function useAssignXxxMenus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, menuIds }: { id: number; menuIds: number[] }) =>
      request.put<null>(`/api/xxxs/${id}/menus`, { menuIds }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: xxxKeys.detail(id) });
    },
  });
}
```

> 关联下拉源属于**所有者域**：需要全量 Yyy 列表时，在 Yyy 的域文件里开 `lookup: true` 并导出 `useAllYyys`，
> 不要在本域用本域 key 去请求 Yyy——Yyy 增删改时没有任何来源会失效它。

---

## 完整页面模板

```tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form, Input, Select, Spin,
  Toast, Modal, Switch, Row, Col,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Search } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import ExportButton from '@/components/ExportButton';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { DateRangeFilter, KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { createdAtColumn, renderEllipsis } from '@/utils/table-columns';
import { useDictItems } from '@/hooks/useDictItems';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { confirmDelete } from '@/utils/confirm';
// 有日期时间范围筛选时引入：
// import { formatDateTimeRangeForApi } from '@/utils/date';
// 仅在 beforeSave 需要中断提交时引入：
// import { abortSubmit } from '@/lib/abort-submit';
import { useDeleteXxxs, useSaveXxx, useXxxDetail, useXxxList, xxxKeys } from '@/hooks/queries/xxxs';
import type { Xxx } from '@zenith/shared/{业务域}';

// ─── 搜索参数类型 ────────────────────────────────────────────────────────
interface SearchParams {
  keyword: string;
  status: string;
  // 如有时间范围筛选：
  // timeRange: [Date, Date] | null;
}

const defaultSearchParams: SearchParams = {
  keyword: '',
  status: '',
};

// ════════════════════════════════════════════════════════════════════════════
// 主组件
// ════════════════════════════════════════════════════════════════════════════
export default function XxxPage() {
  const { hasPermission } = usePermission();

  // ─── 搜索状态：draft 绑输入框，submitted 进 query key ────────────────────
  // useListSearch 内部整合了 usePagination，并保证「查询 / 重置」必定失效 listKey，
  // 契约由 hook 兜住——禁止再手写 draft/submitted 双状态与 handleSearch/handleReset
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: xxxKeys.lists });

  // ─── 列表查询（key 驱动：page/pageSize/submittedParams 变化自动请求）────
  const listQuery = useXxxList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    // 如有标准 startTime / endTime 日期时间范围（Date → 字符串后再进 params）：
    // ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  // ─── 弹窗状态由 useEditModal 托管（见下方）───────────────────────────────
  // ─── 新增/编辑弹窗 ─────────────────────────────────────────────────────
  // useEditModal 焊死四条漏写不报错的契约：校验失败必须抛出、提示文案区分新增/编辑、
  // 保存后关闭并清空 editing、以及**详情到达时按 key 重挂载表单**
  // （initValues 只在挂载时读一次，没有 key 时异步详情永远进不了表单）。
  // 禁止再手写 useRef<FormApi> + editingRecord + validate/try-catch 四件套。
  // beforeSave 中需要中断提交时用 abortSubmit()，不要 return、也不要抛裸 Error。
  const modal = useEditModal<Xxx>({
    entityName: '示例',              // 自动生成标题「新增示例 / 编辑示例」
    save: useSaveXxx(),
    useDetail: useXxxDetail,         // 编辑时懒加载详情，必须是模块级稳定函数
    defaults: { status: 'enabled' }, // 仅新增时使用
    toValues: (r) => ({              // 可选：裁剪回填字段
      name: r.name,
      description: r.description,
      status: r.status,
      // 多对多字段示例：yyyIds: r.yyyIds ?? [],
    }),
    // 表单值 → 提交载荷；也是做跨字段校验的地方
    // beforeSave: (values) => {
    //   if (!values.expireAt) { Toast.warning('请选择过期时间'); abortSubmit(); }
    //   return { ...values, expireAt: formatDateTimeForApi(values.expireAt) };
    // },
    // 保存后的副作用（展示初始密码、跳转…）：
    // onSaved: (saved, { isEdit }) => { ... },
    // 保存后另有更强反馈时抑制默认提示：
    // successMessage: () => null,
  });

  // ─── 其余变更 hooks ────────────────────────────────────────────────────
  const toggleStatusMutation = useSaveXxx();  // 行级 Switch 专用实例，便于按行显示 pending
  const deleteMutation = useDeleteXxxs();
  const togglingId = toggleStatusMutation.isPending ? (toggleStatusMutation.variables?.id ?? null) : null;

  // 字典数据（内部已是 useQuery，全局共享缓存）
  const { items: statusItems } = useDictItems('common_status');

  // ─── 导出（导出中心）──────────────────────────────────────────────────
  function buildExportQuery(): Record<string, unknown> {
    return {
      keyword: submittedParams.keyword || undefined,
      status: submittedParams.status || undefined,
    };
  }

  // ─── 删除 ──────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  // ─── 状态切换（Switch 直接修改）────────────────────────────────────────
  // status 字段为 'enabled'|'disabled' 时使用此模式；boolean 字段改为 { isEnabled: checked }
  function handleToggleStatus(record: Xxx, checked: boolean) {
    const doToggle = () => {
      toggleStatusMutation.mutate(
        { id: record.id, values: { status: checked ? 'enabled' : 'disabled' } },
        { onSuccess: () => Toast.success(checked ? '已启用' : '已停用') },
      );
    };
    if (checked) {
      doToggle();
    } else {
      Modal.confirm({
        title: '确认停用',
        content: `停用后「${record.name}」将不再可用，确认停用？`,
        onOk: doToggle,
      });
    }
  }

  // ─── 表格列定义 ────────────────────────────────────────────────────────
  const columns: ColumnProps<Xxx>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 260,
      render: renderEllipsis,
    },
    createdAtColumn,  // 创建时间预置列（自动 formatDateTime）
    {
      // 状态列：放在操作列左侧紧靠操作列，必须 fixed: 'right'
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right',
      render: (_: unknown, record: Xxx) => (
        <Switch
          checked={record.status === 'enabled'}
          loading={togglingId === record.id}
          disabled={!hasPermission('system:xxx:update')}
          onChange={(checked) => handleToggleStatus(record, checked)}
          size="small"
        />
      ),
    },
    createOperationColumn<Xxx>({
      width: 160,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        ...(hasPermission('system:xxx:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('system:xxx:delete') ? [{
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({
              title: '确定要删除吗？',
              content: '删除后不可恢复',
              onOk: () => handleDelete(record.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  // 筛选控件统一走 search-filters，禁止手写 prefix / showClear / 宽度这类装饰性属性
  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  // 如有时间范围筛选：
  // const renderTimeRangeFilter = () => (
  //   <DateRangeFilter
  //     value={draftParams.timeRange}
  //     onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))}
  //   />
  // );

  // 查询 / 重置 / 新增按钮统一走 toolbar-controls，禁止手写 <Button icon={<Search .../>}>查询</Button>
  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;

  const renderResetButton = () => <ResetButton onClick={handleReset} />;

  const renderCreateButton = () => hasPermission('system:xxx:create')
    ? <CreateButton onClick={modal.openCreate} /> : null;

  const renderExportButtons = () => hasPermission('system:xxx:export') ? (
    <ExportButton entity="system.xxxs" query={buildExportQuery()} />
  ) : null;

  const renderMobileExportActions = () => hasPermission('system:xxx:export') ? (
    <ExportButton entity="system.xxxs" query={buildExportQuery()} label="导出" variant="flat" />
  ) : null;

  // mobileActions 中的普通操作按钮统一使用 theme="borderless"；
  // 导出操作优先使用 ExportButton variant="flat"。

  // ════════════════════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container">
      {/* 搜索区：筛选/操作较多时使用结构化 SearchToolbar，移动端自动精简 */}
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderStatusFilter()}
            {renderSearchButton()}
            {renderResetButton()}
          </>
        )}
        actions={(
          <>
            {renderExportButtons()}
            {renderCreateButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderKeywordSearch()}
            {renderSearchButton()}
            {renderCreateButton()}
          </>
        )}
        mobileFilters={(
          <>
            {renderStatusFilter()}
          </>
        )}
        mobileActions={renderMobileExportActions()}
        filterTitle="筛选条件"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      {/* 数据表格 */}
      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无数据"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      {/* 新增/编辑弹窗（共用一个） */}
      {/*
        AppModal 宽度规则：
        - 有 3 对以上可并排的普通字段 → width={660}，双列布局
        - 字段较少或含 TreeSelect/TextArea 等宽字段 → width 480-520，单列布局
      */}
      <AppModal {...modal.modalProps} width={660}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          {/*
            formProps 已包含 key（含详情到达时的重挂载）、getFormApi、allowEmpty、
            initValues、labelPosition 与 labelWidth。labelWidth 需要覆盖时在
            useEditModal 的 labelWidth 选项里传：3字标签→72，4-5字→90，6字+→110+
          */}
          <Form {...modal.formProps}>
            {/* 全宽字段（跨两列，如树形选择、长文本）：直接写，不包裹 Col */}
            <Form.TreeSelect
              field="parentId"
              label="上级"
              style={{ width: '100%' }}
              treeData={[]}
              placeholder="请选择上级"
              filterTreeNode
              showClear
            />
            {/* 双列布局：Row gutter={16} + Col span={12}，每行放 2 个字段 */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field="name"
                  label="名称"
                  placeholder="请输入名称"
                  rules={[{ required: true, message: '名称不能为空' }]}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field="code"
                  label="编码"
                  placeholder="请输入编码"
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Select
                  field="status"
                  label="状态"
                  style={{ width: '100%' }}
                  optionList={statusItems.map((i) => ({
                    value: i.value,
                    label: i.label,
                  }))}
                  rules={[{ required: true, message: '请选择状态' }]}
                />
              </Col>
              {/* 奇数个字段时，最后一个 Col span={12} 单独占左半列 */}
            </Row>
            {/* 如需关联选择，在此添加 Form.Select 多选等 */}
          </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
```

---

## 关键规范说明

### 数据获取补充规范

- **弹窗内交互态从查询数据播种**（如授权勾选）：`useEffect(() => { if (visible) setCheckedIds(detailQuery.data?.menuIds ?? []); }, [visible, detailQuery.data]);`
- **轮询**：`useQuery({ ..., refetchInterval: 5000 })`；条件轮询用函数形式 `refetchInterval: (query) => hasRunning(query.state.data) ? 5000 : false`。
- **上传进度**：`request.postForm(url, formData, { onProgress })` 包进 mutationFn，参数形如 `{ formData, onProgress }`（参考 `hooks/queries/users.ts` 的 import mutation）。
- **enabled 门控查询的 loading 判断**：`enabled: false` 时 `isPending` 恒为 true，整页 loading 判断必须写成 `(!!id && query.isPending)`，否则新建模式会卡死在 Spin。
- **member C 端 SPA**（`src/member/`）：使用独立 `memberQueryClient`（`member/lib/member-query.ts`）+ `memberRequest` 传输层，hooks 位于 `member/hooks/queries.ts`，其余约定与后台一致。

### 页面级多 Tab 布局

当页面最外层是多个业务 Tab（如「列表/统计」「配置/日志」「全部/未读/已读」）时，使用统一页面壳层：

```tsx
return (
  <div className="page-container page-tabs-page">
    <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" lazyRender keepDOM={false}>
      <TabPane tab="列表" itemKey="list">
        <SearchToolbar>
          {/* 当前 tab 的筛选与操作按钮 */}
        </SearchToolbar>
        <ConfigurableTable bordered ... />
      </TabPane>
      <TabPane tab="统计分析" itemKey="stats">
        <StatsPanel />
      </TabPane>
    </Tabs>
  </div>
);
```

规则：

- 每个 `TabPane` 内承载该 tab 的完整内容：`SearchToolbar`、操作按钮、空状态、`ConfigurableTable` 或统计面板。
- 禁止把 `TabPane` 写成空 tab 后在 `Tabs` 外部根据 `activeTab` 渲染表格、空状态或按钮。
- tab 相关操作按钮（如「全部标记为已读」「清理日志」「刷新当前 tab」）放在对应 `TabPane` 内的 `SearchToolbar`，不要放在 TabBar 右侧。
- `page-tabs-page` 只用于页面最外层业务 Tabs；抽屉、弹窗、卡片内代码示例、左右分栏内部小 tabs 不使用。
- 非激活 tab 的查询建议用 `enabled: activeTab === 'xxx'` 门控，切换时自动懒加载并缓存。

### 弹窗表单布局规范

**`labelPosition="left"`（label 与输入框同行）、`closeOnEsc` 与表单重挂载 `key` 均已由
`useEditModal` 的 `formProps` / `modalProps` 提供，不要在页面里重复书写。**
`labelWidth` 需要偏离默认值 90 时，在 `useEditModal({ labelWidth })` 里传：
3 字标签→ 72，4-5 字→ 90，6 字以上→ 110+。

**Modal 宽度与表单列数**（`width` 仍由页面按内容决定，展开 `modalProps` 后单独传）：

- 有 **3 对及以上可并排的普通字段**（Input / Select / InputNumber 等）→ 使用双列布局，`width={660}`
- 字段较少，或主要是 TreeSelect / TextArea 等不适合并排的字段 → 使用单列布局，`width` 在 480–520 之间酌情选取

不经 `useEditModal` 的弹窗（纯展示、确认类）仍需自行加 `closeOnEsc`。

**双列布局规则（用 `Row` + `Col`，来自 `@douyinfe/semi-ui`）：**

```tsx
import { Row, Col } from '@douyinfe/semi-ui';

// 每行两个字段：Row gutter={16} + Col span={12}
<Row gutter={16}>
  <Col span={12}>
    <Form.Input field="name" label="名称" ... />
  </Col>
  <Col span={12}>
    <Form.Input field="code" label="编码" ... />
  </Col>
</Row>

// 全宽字段（树形选择、长文本、多行输入等）：不包 Col，直接写
<Form.TreeSelect field="parentId" label="上级" style={{ width: '100%' }} ... />

// 奇数个字段时最后一个单独占左半列（不强制凑满一行）
<Row gutter={16}>
  <Col span={12}>
    <Form.Select field="status" label="状态" style={{ width: '100%' }} ... />
  </Col>
</Row>
```

**labelWidth 选取原则：**

- 标签文字 ≤3 字（名称、状态、邮箱）→ `labelWidth={72}`
- 标签文字 4–5 字（部门名称、联系电话）→ `labelWidth={90}`
- 标签文字 ≥6 字（上级部门名称、所属租户等）→ `labelWidth={110}` 或 120
- 同一个 Form 内保持统一

### 状态字段显示

- 使用 `useDictItems('common_status')` 获取字典选项（内部为 useQuery，同一 code 全局共享缓存、自动去重）
- 表格中用 `<DictTag dictCode="common_status" value={status} />` 或手动 `find` 映射

### 时间格式化与省略文本

```ts
// ✅ 正确：使用预置列（自动格式化+省略 tooltip）
import { createdAtColumn, renderEllipsis } from '../../utils/table-columns';
// 使用：columns = [..., createdAtColumn];
// 省略列：render: renderEllipsis

// ✅ 仍可直接调用（非列 render 场景）
import { formatDateTime } from '../../utils/date';
formatDateTime(someDate)

// ❌ 禁止：不要在组件中使用原生 locale 或 ISO 时间格式化 API
```

### 操作列按钮样式

```tsx
// ✅ 正确：使用 createOperationColumn。默认桌面端内联全部动作；
// 设置 desktopInlineKeys 后，只把高频动作作为内联按钮展示，其余动作进入更多菜单。
// 移动端会自动收窄操作列，并将全部动作收进更多菜单。
createOperationColumn<Xxx>({
  width: 160,
  desktopInlineKeys: ['edit', 'delete'],
  actions: (record) => [
    { key: 'edit', label: '编辑', onClick: () => modal.openEdit(record) },
    { key: 'delete', label: '删除', danger: true, onClick: () => handleDelete(record.id) },
  ],
})
```

### 搜索参数与分页联动

```ts
// ✅ 正确：统一用 useListSearch，禁止手写 draft/submitted 双状态与两个 handler
// - draftParams 绑定输入框，输入过程不触发请求
// - submittedParams 进入 query key，变化自动请求
// - handleSearch / handleReset 内部必定失效 listKey，保证「条件未变时点查询」也回源
const {
  page, pageSize, buildPagination,
  draftParams, setDraftParams, submittedParams,
  handleSearch, handleReset,
} = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: xxxKeys.lists });

// 翻页：buildPagination(total) 内部 setPage/setPageSize → key 变化自动请求，无需回调
```

可选项，按需使用：

| 选项 | 用途 |
| --- | --- |
| `extraKeys` | 一个页面同时驱动多个列表时，一并失效它们的 key |
| `pageSize` | 覆盖默认页大小（默认取用户偏好） |
| `onSearch` / `onReset` | 查询/重置后的额外副作用，如清空已选中的行 |
| `defaults` 传函数 | 「最近 7 天」这类相对当前时间的默认条件，每次重置重新求值 |

**不经输入框直接筛选**（点部门树 / 标签 / 收藏开关 / 应用保存的视图）用 `applySearch(params)`：

```tsx
const { draftParams, applySearch } = useListSearch<SearchParams>({ ... });

onSelect={(deptId) => applySearch({ ...draftParams, departmentId: deptId })}
```

它同步更新 draft 与 submitted、回到第 1 页并失效列表。
**禁止**为这类场景去暴露/调用 `submittedParams` 的裸 setter——那会绕过页码重置与失效，
正是「点了筛选但列表没刷新」这类问题的来源。

### 搜索工具栏筛选控件

关键字、状态、时间范围三类筛选统一用 `@/components/search-filters`，
**禁止**手写 `prefix={<Search size={14} />}`、`showClear`、`style={{ width }}`
这类装饰性属性——改一次图标或尺寸不该扫遍两百多个页面：

```tsx
import { DateRangeFilter, KeywordInput, StatusSelect } from '@/components/search-filters';

<KeywordInput placeholder="搜索名称/编码" value={draftParams.keyword}
  onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} />

<StatusSelect items={statusItems} value={draftParams.status}
  onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))} />

<DateRangeFilter value={draftParams.timeRange}
  onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))} />
```

| 组件 | 内置默认 | 覆盖方式 |
| --- | --- | --- |
| `KeywordInput` | 放大镜前缀、`showClear`、宽度 220 | `width` / `style` / 其余 props 原样穿透 |
| `StatusSelect` | 占位「全部状态」、`showClear`、宽度 120 | `placeholder` / `width` |
| `DateRangeFilter` | `dateTimeRange`、占位「开始时间/结束时间」、宽度 360 | `type="dateRange"`（宽度自动取 260）/ `placeholder` / `width` |

- 三者只收敛**装饰性属性**，业务属性（`value` / `onChange` / `placeholder`）仍显式传入
- `StatusSelect` 清空时回调空串而非 `undefined`，与 `draftParams` 里状态字段的类型对齐
- `DateRangeFilter` 把 Semi 宽松的 `onChange` 收窄为 `[Date, Date] | null`，页面不必再写
  `Array.isArray(v) && v.length >= 2` 之类的判断
- **例外**：面板/弹窗内需要跟随容器自适应的搜索框（如 `NavListPanel` 的 List header）
  不套用这些控件——它们带固定默认宽度，会改变布局

### 危险操作确认
破坏性操作（删除、清空、彻底移除、重置密钥、撤销令牌、截断表、终止流程…）
统一用 `@/utils/confirm`，**禁止**手写 `okButtonProps: { type: 'danger', theme: 'solid' }`：

```ts
import { confirmDanger, confirmDelete } from '@/utils/confirm';

// 删除：默认标题「确定要删除吗？」
confirmDelete({ onOk: () => handleDelete(row.id) });

// 删除：指明对象的具体文案（优先，比通用文案更能防误操作）
confirmDelete({ title: '确定要删除该标签吗？', content: '删除后不可恢复', onOk });

// 其它破坏性操作
confirmDanger({ title: `重置「${name}」的签名密钥？`, content: '旧密钥将立即失效', onOk });
```

- 两者都会注入红色实心确认按钮；漏写这条样式，「确定删除」与「确定提交」在用户眼里是同一个按钮
- 除按钮样式外所有选项原样透传给 `Modal.confirm`，**文案不做统一**
- 需要弱化样式时可覆盖：`confirmDanger({ ..., okButtonProps: { theme: 'borderless' } })`
- **非破坏性确认**（提交、发布、启用、退出、导出…）继续用原生 `Modal.confirm`，不加 danger

### 权限控制

```tsx
// 使用 hasPermission() 控制按钮显示
const { hasPermission } = usePermission();

{hasPermission('system:xxx:create') && <Button>新增</Button>}
{hasPermission('system:xxx:update') && <Button>编辑</Button>}
{hasPermission('system:xxx:delete') && <Button>删除</Button>}
```

---

## 批量操作前端模板

> 仅在用户确认需要批量操作时添加，并非所有列表都需要。

```tsx
// 1. 状态声明（deleteMutation 复用上文 useDeleteXxxs）
const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

// 2. 批量删除 handler
const handleBatchDelete = () => {
  confirmDelete({
    title: `确认删除选中的 ${selectedRowKeys.length} 条记录？`,
    content: '删除后无法恢复，请谨慎操作。',
    onOk: async () => {
      await deleteMutation.mutateAsync(selectedRowKeys);
      Toast.success('批量删除成功');
      setSelectedRowKeys([]);
    },
  });
};

// 3. 工具栏中的批量按钮（仅选中时显示，放在查询/重置按钮之后）
{selectedRowKeys.length > 0 && hasPermission('system:xxx:delete') && (
  <Button type="danger" theme="light" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>
    批量删除 ({selectedRowKeys.length})
  </Button>
)}

// 4. ConfigurableTable 增加 rowSelection
<ConfigurableTable
  rowSelection={{
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as number[]),
  }}
  bordered
  onRefresh={() => void listQuery.refetch()}
  refreshLoading={listQuery.isFetching}
  ...
/>
```

> `request.delete(url, body)` 支持传请求体（`packages/web/src/utils/request.ts` 已实现）；`useDeleteXxxs` 内部据 ids 长度自动选择单删/批量接口。

---

## 虚拟化表格（大数据量）

当列表数据量较大（通常 > 500 条，如地区省市县、日志等）时，为 `ConfigurableTable` 开启 `virtualized`。

### 弹性全宽方案（推荐）

让**一列不设 `width`**（通常是名称/标题主列），表格自动填满容器。`fixed: 'right'` 仅保留操作列，状态列等其他列去掉 `fixed`。

```tsx
const columns: ColumnProps<Region>[] = [
  {
    title: '地区名称',
    dataIndex: 'name',
    // 不设 width — 弹性列，填满剩余宽度
  },
  { title: '区划代码', dataIndex: 'code', width: 140 },
  { title: '级别',     dataIndex: 'level', width: 90 },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    // 注意：不加 fixed: 'right'，否则必须设 scroll.x 导致宽度固定
  },
  createOperationColumn<Region>({
    width: 160,
    actions: (record) => [
      { key: 'edit', label: '编辑', onClick: () => modal.openEdit(record) },
    ],
  }),
];

<ConfigurableTable
  bordered
  virtualized
  scroll={{ y: 'calc(100vh - 260px)' }}  // 只设 y，不设 x
  columns={columns}
  dataSource={list}
  rowKey="id"
  pagination={false}
  onRefresh={() => void treeQuery.refetch()}
  refreshLoading={treeQuery.isFetching}
/>
```

### 固定宽度方案

所有列都有显式 `width` 时（含 `fixed: 'right'` 的状态列），必须设 `scroll.x` = 各列宽度之和，否则表头与数据行错位：

```tsx
<ConfigurableTable
  virtualized
  scroll={{ x: 1050, y: 'calc(100vh - 260px)' }}
  columns={columns}
/>
```

> 缺点：`scroll.x` 固定后表格在宽屏不填满容器。

### 注意事项

- `scroll.y` 是虚拟化生效的**必要条件**，`calc(100vh - 260px)` 适配大多数管理页面布局（260px ≈ 顶栏 + 工具栏 + 内边距）
- 部门管理等数据量小（< 200 条）且有复杂自定义渲染器的树形表格，**不建议**开启 `virtualized`；菜单管理（880+ 节点）、地区管理等大数据量树形表格已开启
- 开启 `virtualized` 后，`expandedRowKeys` 受控展开仍正常工作，无需额外处理

---

## ConfigurableTable 刷新按钮（必须实现）

**所有使用 `ConfigurableTable` 的列表页均必须传入 `onRefresh` 和 `refreshLoading`**，否则表格工具栏不会显示刷新按钮。

```tsx
<ConfigurableTable
  bordered
  columns={columns}
  dataSource={list}
  loading={listQuery.isFetching}
  rowKey="id"
  onRefresh={() => void listQuery.refetch()}   // ← 必须传
  refreshLoading={listQuery.isFetching}        // ← 必须传
  pagination={buildPagination(total)}
/>
```

规则：

- `onRefresh`：调用当前列表查询的 `refetch()`，保持分页位置不变；若组件无独立数据加载（如结构/上下文驱动的表格），可不传
- `refreshLoading`：与 `loading` 一样统一使用 `listQuery.isFetching`，按钮转圈期间防重复点击
- SideSheet / Modal 内的**次级**表格（投递记录、操作历史等）同样需要传入对应查询的 `refetch`

---

## 左右分栏布局（MasterDetailLayout）

适用于消息中心、智能对话、AI 侧边栏、数据库管理表浏览、日志文件等具有「左侧列表 + 右侧详情」结构的页面。统一使用 `MasterDetailLayout` 组件，路径：`packages/web/src/components/MasterDetailLayout.tsx`。

桌面端默认允许调换 master 左右位置：master 使用 `MasterDetailLayout.Header` 或 `NavListPanel`
时切换按钮自动位于操作区最右侧，业务页面无需也不得重复渲染按钮。`persistKey` 会同时记住宽度
与左右位置；窄屏单栏不显示该按钮。只有新增另一种公共 master 标题组件时，才在该公共组件内部
接入 `MasterDetailLayout.SideToggle`。

### 标准模式：页面直接作为 Outlet 根节点

页面直接从 `admin-content`（flex 容器，分配了确定高度）继承高度，**直接返回 MasterDetailLayout**，无需外层 wrapper：

```tsx
import MasterDetailLayout from '@/components/MasterDetailLayout';

export default function XxxPage() {
  return (
    <MasterDetailLayout
      defaultSize={260}        // 左栏默认宽度
      minSize={200}
      maxSize={480}
      persistKey="xxx-page"    // localStorage 持久化键
      master={(
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* 顶部固定区域（搜索/工具栏） */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0 }}>
            ...
          </div>
          {/* 滚动列表区域 */}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            ...
          </div>
        </div>
      )}
      detail={(
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          ...
        </div>
      )}
    />
  );
}
```

### 嵌套在 Semi Design Tabs 内时

Semi Design 的 `semi-tabs-pane-motion-overlay` 会打断高度继承链，必须采用以下完整写法：

**高度链约束**（缺一不可）：

1. 页面根 div：`height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden'`
2. `<Tabs>` 加 `className="tabs-fill-height"`（已在 `global.css` 定义）、`style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}`、`contentStyle={{ flex: 1, minHeight: 0, overflow: 'hidden' }}`
3. 需要全高的 `<TabPane>` 加 `style={{ height: '100%' }}`
4. TabPane 内层 wrapper div：`style={{ height: '100%' }}`

```tsx
export default function XxxPage() {
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Tabs
        className="tabs-fill-height"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        contentStyle={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        tabBarStyle={{ marginBottom: 8 }}
      >
        <TabPane tab="列表" itemKey="list" style={{ height: '100%' }}>
          <div style={{ height: '100%' }}>
            <MasterDetailLayout
              defaultSize={300}
              minSize={220}
              maxSize={520}
              persistKey="xxx-list"
              master={(
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  <div style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0 }}>
                    {/* 搜索/过滤 */}
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    {/* 列表内容 */}
                  </div>
                </div>
              )}
              detail={<div>详情区域</div>}
            />
          </div>
        </TabPane>
        <TabPane tab="其他" itemKey="other">
          {/* 其他 tab 无高度限制需求时不需要加 style={{ height: '100%' }} */}
        </TabPane>
      </Tabs>
    </div>
  );
}
```

### 主侧在右时（`side="right"`）

某些页面左侧为主内容区，右侧为可收起的辅助面板（如 AI 侧边栏）：

- 将宽的内容放在 `detail`（左侧，`flex:1`）
- 将窄的可调整面板放在 `master`（右侧，`flexShrink:0`）
- 设置 `side="right"` 使 master 渲染在右边

```tsx
<MasterDetailLayout
  side="right"
  defaultSize={380}
  minSize={300}
  maxSize={600}
  collapsed={!panelVisible}
  persistKey="xxx-sidebar"
  detail={<MainContent />}    // 宽的主体内容（左侧）
  master={<SidePanel />}      // 窄的辅助面板（右侧，可调整宽度）
/>
```

### 窄屏单栏（响应式）

容器宽度小于 `responsiveBreakpoint`（默认 `720`）时自动切换为单栏，一次只渲染一侧。
**该断点比较的是容器宽度而非视口宽度**——后台内容区还要扣除侧边栏，勿按视口断点估算。

按语义选择哪一侧是根视图，两类各有固定写法：

**A 类「列表 → 详情」**：master 是列表（根视图），detail 是选中项详情。窄屏先显示 master，
选中后进入 detail，返回条由组件渲染在 detail 侧。

```tsx
<MasterDetailLayout
  showDetail={selected !== null}
  onBack={() => setSelected(null)}
  master={<List onSelect={setSelected} />}
  detail={<Detail record={selected} />}
/>
```

**B 类「筛选树 + 主体内容」**：master 是分类/部门等筛选器，detail 才是页面主体（表格）。
窄屏先显示 detail，返回条由组件渲染在 master 侧；进入 master 的入口由页面自己放进工具栏。

```tsx
<MasterDetailLayout
  showDetail={!showTree}
  onMasterBack={() => setShowTree(false)}
  masterBackLabel="返回用户列表"        // 缺省为「返回」
  master={<DeptTree />}
  detail={<ConfigurableTable ... />}
/>
```

**禁止在窄屏自动选中首项。** 双栏下默认选中首项可避免右侧空白，但单栏会直接落到详情，
根视图反而要点返回才能看到列表。用 `onResponsiveChange` 记录布局形态，仅双栏时自动选中，
并在由窄屏切回双栏时补选：

```tsx
const isNarrowLayoutRef = useRef(false);

useEffect(() => {
  setSelected((prev) => {
    if (list.length === 0) return null;
    const current = prev ? list.find((x) => x.id === prev.id) : null;
    if (current) return current;
    return isNarrowLayoutRef.current ? null : list[0];
  });
}, [list]);

<MasterDetailLayout
  showDetail={!!selected}
  onBack={() => setSelected(null)}
  onResponsiveChange={(narrow) => {
    isNarrowLayoutRef.current = narrow;
    if (!narrow) setSelected((prev) => prev ?? list[0] ?? null);
  }}
/>
```

用 ref 而非 state 保存布局形态，使自动选中的 effect 只依赖数据、不因布局变化重跑。

### 常见陷阱

- **master 内需要头部 + 滚动列表**：必须在 master 内用 flex column 容器包裹，搜索头固定（`flexShrink: 0`），列表 flex: 1 + overflow: auto + minHeight: 0
- **不要把 master 的 div 写成 Fragment（`<>`）**：Fragment 无法接受 `height: '100%'`，列表将无高度约束
- **Tabs 嵌套时不加 `className="tabs-fill-height"`**：会导致 Semi Design 的动画层破坏高度链，列表内容撑满后无滚动
- **MasterDetailLayout 的 `gap` 默认为 0**：如不需要间距且无边框，保持默认即可
- **B 类页面漏传 `onMasterBack`**：窄屏切到 master 后无返回入口，用户只能靠浏览器后退退出
- **窄屏自动选中首项**：根视图变成详情，列表需点返回才能抵达

---

## 左侧平铺列表（NavListPanel）

左侧 master 是**平铺列表**（分类 / 文件 / 分组等，非树形）时使用 `NavListPanel<T>` + `NavListItem`
（`packages/web/src/components/NavListPanel.tsx`）。底层由 Semi `List` / `List.Item` 实现，
已对齐 Semi「带筛选器」最佳实践。树形数据（需要展开/折叠节点）改用 Semi `Tree`，例如用户管理的部门树。

- `NavListPanel<T>` 核心 props：`title`、`headerExtra`、`search`（搜索框配置）、`loading`、`emptyText`、`footer`（分页等）
- **推荐用法（dataSource 模式）**：`<NavListPanel dataSource={items} renderItem={(item) => <NavListItem key={item.id} .../>} />`，空数组时自动显示 `emptyText`
- **兼容用法（children 模式）**：`<NavListPanel>{items.map(fn)}</NavListPanel>`，空数组不触发 emptyContent（需 `childCount > 0` 判断）；rawBody 场景必须走此路径
- **分组 / Collapse 场景**（如 DbAdmin）：传 `rawBody bodyNoPadding`，在 `children` 内自行渲染 Collapse + 内嵌 `<List split={false} className="nav-list-panel__list">`
- `NavListItem` props：`active`、`onClick`、`icon`（左侧图标或彩色圆点）、`primary`（主标题）、`secondary`（副标题）、`meta`（底部元信息）、`extra`（hover 显示的操作区，`extraAlwaysVisible` 让其常驻）
- extra 含多个操作时用 `Dropdown`（`trigger="click"` + `clickToHide`）+ `MoreHorizontal` 按钮包裹，参考字典管理 / 日志文件页面
- meta 区域**禁止**使用 `<Tag color="...">` 内联标签（会渲染颜色指示器色块），改用 styled span（见日志文件页实现）

---

## 统计卡片与自适应栅格

指标卡与卡片栅格统一走公共组件，**禁止**内联写死列数——内联样式无法被媒体查询覆盖。

### StatCard / StatGrid（`packages/web/src/components/charts/StatCard.tsx`）

```tsx
// 无图表的页面直接引具体文件，避免桶文件带入约 2MB 的 vchart
import { StatCard, StatGrid } from '@/components/charts/StatCard';
// 页面本来就有图表时，从桶文件一起引即可
// import { LineChart, chartOptions, StatCard, StatGrid } from '@/components/charts';

<StatGrid minItemWidth={180}>
  <StatCard title="今日 PV" value={stats.pv} icon={<Eye size={19} />} accent="#3b82f6" />
  {/* 环比：absolute 展示差值，ratio 按比率渲染成百分比（0.12 → +12.0%） */}
  <StatCard title="今日 UV" value={stats.uv} delta={stats.uvDelta} deltaFormat="absolute" />
  {/* 可点击筛选卡：渲染为 button，自动带 aria-pressed 与选中边框 */}
  <StatCard
    title="审批中"
    value={stats.running}
    accent="var(--semi-color-primary)"
    onClick={() => applySearch({ status: 'running' })}
    active={draftParams.status === 'running'}
  />
</StatGrid>
```

`StatGrid` 用 `auto-fit` + `minmax(min(minItemWidth, 100%), 1fr)`，容器变窄自动降列，
`min()` 保证容器比单列还窄时也不溢出。

### 图表分栏（`.chart-grid`）

```tsx
{/* 等宽多图：最小 380px，xl 以上锁两列（三列以上横轴过密） */}
<div className="chart-grid">
  <Card title="趋势"><LineChart {...spec} /></Card>
  <Card title="分布"><PieChart {...spec} /></Card>
</div>

{/* 主图 + 侧栏的非对称布局：宽屏 1.6fr / 0.9fr，lg 以下收敛单列 */}
<div className="chart-grid chart-grid--aside">
  <Card title="事件脉冲"><AreaChart {...spec} /></Card>
  <Card title="热门页面">…</Card>
</div>
```

`.chart-grid` 的两列锁定走的是**视口**断点。若栅格位于抽屉、弹窗或分栏面板等
**比视口窄得多的容器**内，改用 `StatGrid`（纯容器自适应，不看视口）。

### 通用自适应栅格（`.auto-grid`，`global.css`）

固定列数的卡片栅格、表单多列、选择器画廊用它。轨道下限取「内容最小宽」与「N 等分宽」
的较大者：宽屏由 N 等分宽占优，恰好 N 列；窄屏由 `--auto-grid-min` 接管，自动降列。

```tsx
{/* 弹窗内两列表单：宽屏 2 列，窄到放不下 220px 时收敛单列 */}
<div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
  <Form.Select field="channel" label="渠道" style={{ width: '100%' }} optionList={channelOptions} />
  <Form.Select field="payMethod" label="支付方式" style={{ width: '100%' }} optionList={methodOptions} />
</div>
```

| 变量 | 含义 |
| --- | --- |
| `--auto-grid-min` | 单列内容最小宽，低于此值即降列（默认 220px） |
| `--auto-grid-cols` | **设计列数上限**（默认 4）。不可省——纯 `auto-fit` 会在宽屏多拆一列 |
| `--auto-grid-gap` | 列间距，**必须是单个长度**（同时参与列数计算），默认 16px |
| `--auto-grid-row-gap` | 行间距，省略时跟随 `--auto-grid-gap` |

**不适用 `.auto-grid` 的场景**（保持原写法）：

- 固定像素列的标签/值布局：`'110px minmax(0, 1fr)'`、`'150px 1fr 56px'`
- 等分小方块缩略图：表情面板、聊天媒体网格
- 本身就在固定宽容器内的微指标（父容器写死 `width: 188` 时任何视口都不会破碎）

确需保留 `repeat(auto-*, minmax(Npx, 1fr))` 时，必须写成 `minmax(min(Npx, 100%), 1fr)`，
否则容器比单列还窄时会横向溢出。

### 抽屉 / 弹窗宽度

窄屏适配已由 `global.css` 全局兜底，页面**无需**再写 `width={isMobile ? '100%' : 720}`：

| 断点 | 规则 |
| --- | --- |
| `--sm-down` | `.semi-modal` → `width/max-width: 95vw` |
| `--lg-down` | `.semi-sidesheet-inner` → `max-width: 95vw` |
| `--xs-down` | `.semi-sidesheet-inner` → `width: 100vw` |

因此固定 `width={860}` 的 SideSheet 在 390px 下同样满宽，加 `isMobile` 判断是无效代码。

---

## 导出规范（导出中心）

- 若模块需要导出，后端统一在 `packages/server/src/lib/export-center/definitions/` 中新增 `defineExport` 实体定义，并在 `definitions/index.ts` 注册。
- 导出字段、Excel / CSV 格式、权限、同步 / 异步策略、文件留存、合并表头与自定义样式均写在导出实体定义中。
- 前端统一使用 `ExportButton`，通过 `entity` 指定导出实体编码，通过 `query` 传递当前提交的筛选条件。
- 列表页默认同步明文导出；大数据或特殊敏感场景由实体定义的 `execution` 策略调整。
- 若导出需带筛选条件，统一使用「当前提交查询参数」（`submittedParams`，而非 draft）构造 query，与列表查询保持一致。
