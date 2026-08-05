# 数据获取与服务端状态

前端所有服务端数据（列表、详情、下拉源、统计等）统一由 [TanStack Query v5](https://tanstack.com/query) 管理。`utils/request.ts` 仅作为传输层（token 刷新、错误 Toast 等，见[认证与请求](/frontend/auth-request)），页面不再手写 `loading` / `data` state 与 `fetchXxx` 拉取函数。

::: tip 缓存一致性契约不在本页
「mutation 该失效哪些 key、key 树怎么设计、什么时候不能回填详情、失效行为怎么测」这类可机械核对的规则，
统一维护在 [`crud-frontend.md` → 缓存一致性契约](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-frontend.md)，
硬性约束条目在 [`constraints.md` → 前端层（Step 8）](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)。

本页只讲**分层结构**、**基建 API** 与**页面写法**，规范正文不再复制第二份，避免两处各自漂移。
:::

## 分层结构

```text
packages/web/src/
├── lib/query.ts            # queryClient 单例 + unwrap + toQueryString + LOOKUP_STALE_TIME + createLimiter
├── lib/crud-queries.ts     # createCrudQueries：标准 CRUD 域的 keys + 列表/详情/保存/删除/下拉源工厂
├── hooks/useListSearch.ts  # 列表页搜索状态（draft/submitted + 分页 + 查询必回源）
├── hooks/useEditModal.ts   # 新增/编辑弹窗编排（校验/提示/关闭/表单重挂载）
├── hooks/queries/          # 域 hooks：每个业务域一个文件（users.ts、roles.ts、payment-orders.ts …）
├── utils/request.ts        # 传输层（不变）
└── member/
    ├── lib/member-query.ts # 会员端独立 memberQueryClient
    └── hooks/queries.ts    # 会员端域 hooks（基于 memberRequest）
```

`QueryClientProvider` 在 `main.tsx` 顶层挂载、包裹 `AuthProvider`（会员端在 `App-member.tsx`），开发模式附带 React Query Devtools。退出登录或切换账号时由 `AuthProvider` 清空身份相关的查询与 mutation 缓存（仅保留 `auth-public` 公开配置查询），避免跨账号数据泄漏。

认证会话（`['auth', 'me']`，见 `hooks/queries/auth.ts`）与导航菜单树（`['menus', 'user-tree']`，见 `hooks/queries/menus.ts`）本身也走同一套 Query 体系——权限变更后由 `invalidateCurrentUserAccess(qc)` 统一失效两者，当前登录者的可见范围即时刷新。

## 基建（lib/query.ts）

| 导出 | 说明 |
|------|------|
| `queryClient` | 全局单例。默认 `staleTime: 30s`、`retry: false`、`refetchOnWindowFocus: false` |
| `unwrap(res)` | 解包统一响应：`code !== 0` 时抛 `ApiError`（错误 Toast 已由 request 层弹出，调用方无需重复处理） |
| `ApiError` | 携带 `code` 的业务错误，`mutateAsync` 抛出后可保持弹窗打开 |
| `toQueryString(params)` | 构建查询串，自动过滤 `undefined` / `null` / 空字符串 |
| `LOOKUP_STALE_TIME` | 5 分钟，用于低频 lookup 数据（字典、部门树、用户下拉源等） |
| `createLimiter(max)` | 轻量并发信号量，限制同类请求最大并发数（仪表盘/设计器一屏扇出数十个数据集查询的场景） |

## 基建（lib/crud-queries.ts）

| 导出 | 说明 |
|------|------|
| `createCrudQueries(options)` | 生成标准 CRUD 域的 `keys` 与 `useList` / `useDetail` / `useSave` / `useDelete` / `useLookup`，并固定保存/删除的失效契约 |
| `CrudListParams` | 列表参数基类（`page` / `pageSize`），域内的筛选字段用 `extends` 追加 |

选项：`resource`（key 前缀与默认路径）、`path`（路径与资源名不一致时覆盖）、`lookup`（是否提供下拉源，传字符串可改子路径）、`deleteMode`、`onSaved` / `onDeleted`（跨域联动的额外失效）、`buildQuery`（自定义查询串）。

## 域 hooks 约定

每个业务域一个文件。标准的 key 工厂与列表 / 详情 / 保存 / 删除 / 下拉源五件套由
`createCrudQueries`（`packages/web/src/lib/crud-queries.ts`）生成，不再逐域手抄：

```ts
// hooks/queries/xxxs.ts
export interface XxxListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: xxxKeys,          // { all, lists, list(params), detail(id), lookup }
  useList: useXxxList,    // 已内置 keepPreviousData：翻页/改条件时不闪白
  useDetail: useXxxDetail,
  useSave: useSaveXxx,    // 无 id → POST，有 id → PUT
  useDelete: useDeleteXxxs, // 单条 → DELETE /:id，多条 → DELETE /batch
  useLookup: useAllXxxs,
} = createCrudQueries<Xxx, XxxListParams, Partial<Xxx>, XxxOption>({
  resource: 'xxxs',
  lookup: true,
});
```

工厂固定了失效契约：保存后失效 `detail(id)` + `lists` +（启用时）`lookup`；
删除后 `removeQueries(detail(id))` + 失效 `lists` +（启用时）`lookup`。
手抄这段样板时最容易漏掉的正是这两条——漏了不报错，只表现为「保存成功但列表没变」
或「重新打开弹窗闪出已删除的旧数据」。

域内的非标准接口（分配菜单、导入导出、状态切换…）仍在同一文件手写 `useMutation`，
用工厂导出的 `keys` 按真实副作用失效，并注释说明为何只失效这些。

规则：

- **params 只放可序列化的 string / number**：`Date` 先用 `formatDateTimeForApi` 转字符串，空字符串筛选项映射为 `undefined`
- **失效与 key 设计遵循[缓存一致性契约](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-frontend.md)**（规范正文见 skill，本页不复制）：mutation 在域 hooks 的 `onSuccess` 中按真实副作用失效、key 树按连坐面设计、回填前核对数据形状与可见性、失效行为用 `test-utils/query-harness.ts` 写可证伪的测试
- **Toast 归属**：成功 `Toast.success` 由 `useEditModal` 统一发出（见下方「列表页模式」）；不要额外加错误 Toast（request 层已统一弹出）
- 共享 lookup（`useAllUsers`、`useFlatDepartments`、`useDepartmentTree`、`useMenuTree`、`useAllRoles`、`useAllPositions`、`useDictItems` 等）已存在，直接 import 复用；禁止在页面或新域文件中重复定义同一数据源，也禁止用本域 key 去请求别域资源
- **官方 ESLint 插件已启用**（`@tanstack/eslint-plugin-query`，见 `packages/web/eslint.config.js`）：自动检查不稳定依赖（useQuery/useQueries/useMutation 结果对象不得直接进 deps 数组）等问题；多查询聚合场景用 `useQueries` 的 `combine` 选项产出稳定引用。其中 `exhaustive-deps` 规则因误报较多（如 `silent` 等仅影响行为不影响数据的选项）已关闭——**queryFn 引用的会影响响应数据的变量必须进 queryKey**，这一点靠约定与评审保证

## 列表页模式

列表页统一使用 `useListSearch`（`packages/web/src/hooks/useListSearch.ts`）。它把三件事收在一处：
`usePagination` 的分页状态、**draft / submitted 拆分**（`draftParams` 绑输入框、输入不触发请求；
`submittedParams` 与 `page` / `pageSize` 一起进入 query key），以及查询/重置时的强制失效。

```tsx
const {
  page, pageSize, buildPagination,
  draftParams, setDraftParams, submittedParams,
  handleSearch, handleReset,
} = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: xxxKeys.lists });

const listQuery = useXxxList({
  page, pageSize,
  keyword: submittedParams.keyword || undefined,
  status: submittedParams.status || undefined,
});
```

::: warning 查询必回源
条件未变化时 query key 不变，数据在 `staleTime` 内被视为新鲜将不发请求；
而本系统「查询」按钮兼具刷新语义，必须强制回源。

手写这段失效逻辑极易遗漏，且漏掉后不报错、列表仍有数据，表现只是「点查询没反应」，
几乎不可能在自测中被发现。因此契约由 `useListSearch` 保证，
**禁止**再手写 draft/submitted 双状态与 `handleSearch` / `handleReset`。
:::

可选项：

| 选项 | 用途 |
| --- | --- |
| `extraKeys` | 一个页面同时驱动多个列表时，一并失效它们的 key |
| `pageSize` | 覆盖默认页大小（默认取用户偏好） |
| `onSearch` / `onReset` | 查询/重置后的额外副作用，如清空已选中的行 |
| `defaults` 传函数 | 「最近 7 天」这类相对当前时间的默认条件，每次重置重新求值 |

**不经输入框直接筛选**（点部门树、标签、收藏开关、应用保存的视图）用 `applySearch(params)`，
它同步更新 draft 与 submitted、回到第 1 页并失效列表：

```tsx
onSelect={(deptId) => applySearch({ ...draftParams, departmentId: deptId })}
```

表格接线：

```tsx
<ConfigurableTable
  bordered
  dataSource={listQuery.data?.list ?? []}
  loading={listQuery.isFetching}
  onRefresh={() => void listQuery.refetch()}
  refreshLoading={listQuery.isFetching}
  pagination={buildPagination(listQuery.data?.total ?? 0)}   // 翻页由 key 驱动，无需回调
/>
```

## 弹窗 / 抽屉懒加载

新增/编辑弹窗统一用 `useEditModal`（`packages/web/src/hooks/useEditModal.ts`）。
它内部就是「`enabled` 门控 + 行数据回退」——打开时才请求详情，30s 内重开命中缓存秒开：

```tsx
const modal = useEditModal<Xxx>({
  entityName: '示例',
  save: useSaveXxx(),
  useDetail: useXxxDetail,          // 编辑时懒加载，新增时不请求
  defaults: { status: 'enabled' },
});

<AppModal {...modal.modalProps} width={660}>
  <Spin spinning={modal.detailLoading}>
    <Form {...modal.formProps}>…字段…</Form>
  </Spin>
</AppModal>
```

::: warning 详情到达必须重挂载表单
Semi 的 `initValues` 只在 Form **挂载时**读取一次。弹窗打开的瞬间详情还没回来，
表单先拿列表行占位；详情到达后若没有变化的 `key` 强制重挂载，**详情数据永远进不了表单**。
`useEditModal` 的 `formProps.key` 由 `${id}:${详情是否已到达}` 派生，天然覆盖这一步；
手写弹窗时必须自行保证。
:::

自行管理的弹窗（非新增/编辑语义，如批量操作、审批）仍按下面的形态写：

```tsx
// 交互态从查询数据播种（如授权勾选）
useEffect(() => {
  if (modalVisible) setCheckedIds(detailQuery.data?.menuIds ?? []);
}, [modalVisible, detailQuery.data]);
```

::: tip enabled 门控与 isPending
`enabled: false` 时 `isPending` 恒为 `true`。整页级 loading 判断必须写成 `(!!id && query.isPending)`，否则「新建模式」（无 id）会永久停留在 Spin。
:::

弹窗提交沿用 AppModal 契约：`await mutation.mutateAsync(...)` 失败抛 `ApiError` → 弹窗保持打开；
校验失败必须 `throw`（`useEditModal` 已内置），否则确定按钮会一直停在 loading 态。
行级 pending（如状态 Switch）用专用 mutation 实例派生：`mutation.isPending ? mutation.variables?.id : null`，不再用 useState。

## 轮询与上传

- **轮询**：`refetchInterval: 5000`；条件轮询用函数形式 `refetchInterval: (query) => hasRunning(query.state.data) ? 5000 : false`。禁止手写 `setInterval` 拉数据（倒计时、轮播等纯 UI 定时器不受限）。
- **上传进度**：`request.postForm(url, formData, { onProgress })` 包进 `mutationFn`，参数形如 `{ formData, onProgress }`。

## 会员端（member SPA）

`src/member/` 是独立入口，使用独立的 `memberQueryClient`（`member/lib/member-query.ts`，默认配置与后台一致）和 `memberRequest` 传输层；域 hooks 集中在 `member/hooks/queries.ts`，`unwrap` / `toQueryString` 从 `@/lib/query` 复用。会员退出登录时清空 `memberQueryClient` 缓存。移动端加载更多列表使用 `useInfiniteQuery`。

## 不走 TanStack Query 的场景

以下场景保持原有实现，不强行套用：

- **WebSocket / SSE / 流式**：聊天消息流、进程 SSE 监控、xterm 终端、docker 日志跟随、AI 流式回复
- **一次性动作**：`request.download` 文件下载、验密（`skipAuth`）、网络诊断类单发操作（建模为 mutation 或直接调用均可）
- **与命令式组件深度耦合的数据流**：如 db-admin 表格浏览的 `useTableRowsInfinite`（与 DataGrid 虚拟滚动/undo-redo 耦合）
- **本地优先 + 防抖回写的单属主存储**：`hooks/PreferencesProvider.tsx`。localStorage 必须**同步**提供初值（否则主题/布局会闪一下），服务端读取只是一次性 bootstrap，写入是 500ms 防抖的 fire-and-forget，且全站仅此一个属主（16 个消费方都走 Context 而非网络）。套用查询缓存只增加间接层，不消除任何重复数据源
- **认证前置**：登录、重置密码、OAuth/企业回调、OAuth2 授权页——这些跑在登录态与查询缓存建立之前

> 反过来说，只要是**可缓存的读**或**会影响其他视图的写**，就必须走域 hook。
> 典型反例（均已整改）：模块级 `let cache` + `let inflight` 手写进程缓存与在途去重、
> 同一份状态在多个组件各取一次再用 `CustomEvent` 手工广播失效——这两种写法是在
> 重新实现 `staleTime` 与 `invalidateQueries`，且手写缓存往往永不失效。
