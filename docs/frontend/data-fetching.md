# 数据获取与服务端状态

前端所有可缓存服务端数据（列表、详情、下拉源、统计等）统一由 [TanStack Query v5](https://tanstack.com/query) 管理。`utils/request.ts` 只负责传输层能力（token 注入、401 刷新、统一错误提示、二进制读取等），页面不手写 `loading` / `data` state 与 `fetchXxx` 拉取函数。

::: tip 缓存一致性契约不在本页
「mutation 该失效哪些 key、key 树怎么设计、手写 mutation 什么时候不能回填详情、失效行为怎么测」这类可机械核对的规则，统一维护在 [`query-cache.md` → 缓存一致性契约](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/query-cache.md#缓存一致性契约)，硬性约束条目在 [`constraints-frontend.md` → 缓存与 query key](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints-frontend.md#缓存与-query-key)。

本页只讲分层结构、基建 API 与页面写法，避免同一规则多处维护。
:::

## 分层结构

```text
packages/web/src/
├── lib/query.ts            # queryClient 单例 + unwrap + toQueryString + compactQuery + LOOKUP_STALE_TIME + createLimiter
├── lib/crud-queries.ts     # createCrudQueries：标准 CRUD 域的 keys + 列表/详情/保存/删除/下拉源工厂
├── hooks/useListSearch.ts  # 列表搜索状态：draft/submitted + 分页 + 查询必回源
├── hooks/useEditModal.ts   # 新增/编辑弹窗编排：校验/提交/提示/关闭/表单重挂载
├── hooks/queries/          # 后台域 hooks：每个业务域一个文件
├── utils/request.ts        # 后台 request 实例
└── member/
    ├── lib/member-query.ts # 会员端独立 QueryClient
    ├── hooks/queries.ts    # 会员端域 hooks
    └── utils/member-request.ts
```

后台 `QueryClientProvider` 在 `main.tsx` 顶层挂载并包裹 `AuthProvider`；开发模式在 `App.tsx` 挂载 React Query Devtools。会员端在 `member/App-member.tsx` 挂载独立的 `memberQueryClient` 与 `MemberAuthProvider`。

退出登录、切换账号或添加账号成功时，`AuthProvider` 清空身份相关的查询与 mutation 缓存，仅保留 `auth-public` 公开配置查询，避免跨账号数据泄漏。认证会话 `['auth', 'me']` 与导航菜单树 `['menus', 'user-tree']` 本身也走 Query 体系；权限变化由 `invalidateCurrentUserAccess(qc)` 统一失效这两类数据。

## 基建（lib/query.ts）

| 导出 | 说明 |
| --- | --- |
| `queryClient` | 后台全局单例。默认 `staleTime: 30s`、`retry: false`、`refetchOnWindowFocus: false`；mutation 默认不重试 |
| `unwrap(res)` | 解包统一响应：`code !== 0` 时抛 `ApiError` |
| `ApiError` | 携带业务 `code` 的错误类型，`mutateAsync` 抛出后可保持弹窗打开 |
| `toQueryString(params)` | 构建查询串，过滤 `undefined` / `null` / 空字符串，非空时带 `?` 前缀 |
| `compactQuery(params)` | 过滤空值并返回纯对象，适合传给导出、深链或需要对象参数的接口 |
| `LOOKUP_STALE_TIME` | 5 分钟，用于字典、部门树、用户下拉源等低频 lookup |
| `createLimiter(max)` | 轻量并发信号量，限制同类请求并发数 |

## 基建（lib/crud-queries.ts）

`createCrudQueries` 生成标准 CRUD 域的 query key 与 hooks：`useList`、`useDetail`、`useSave`、`useDelete`、`useLookup`。

| 选项 | 说明 |
| --- | --- |
| `resource` | 资源名，同时作为默认 query key 前缀与默认接口路径 `/api/{resource}` |
| `keyPrefix` | 覆盖 query key 前缀，保留存量嵌套 key 生命周期时使用 |
| `path` | 覆盖接口基础路径 |
| `lookup` | `false` 不生成有效下拉源；`true` 使用 `/all`；字符串表示自定义子路径 |
| `deleteMode` | `'batch'`：单条 `DELETE /:id`、多条 `DELETE /batch`；`'single'`：多条并发单删 |
| `onSaved` / `onDeleted` | 保存/删除成功后的跨域联动失效 |
| `listStaleTime` | 覆盖列表查询 staleTime |
| `buildQuery` | 自定义列表查询串构造函数，默认 `toQueryString` |

工厂固定失效契约：保存后失效 `detail(saved.id)`、`lists` 与可选 `lookup`；删除后 `removeQueries(detail(id))`，再失效 `lists` 与可选 `lookup`。

```ts
export interface XxxListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: xxxKeys,
  useList: useXxxList,
  useDetail: useXxxDetail,
  useSave: useSaveXxx,
  useDelete: useDeleteXxxs,
  useLookup: useAllXxxs,
} = createCrudQueries<Xxx, XxxListParams, XxxValues, XxxOption>({
  resource: 'xxxs',
  lookup: true,
});
```

域内非标准接口（分配菜单、导入导出、状态切换等）仍在同一 `hooks/queries/*.ts` 文件手写 `useMutation`，使用本域或相关所有者域导出的 key 按真实副作用失效。

## 域 hooks 约定

- 每个业务域一个文件，命名与 API 资源一致（如 `users.ts`、`payment-orders.ts`）
- `params` 只放可序列化值；`Date` 先转成 API 字符串，空字符串筛选项映射为 `undefined`
- 下拉源复用所有者域 hook，例如 `useAllUsers`、`useFlatDepartments`、`useDepartmentTree`、`useMenuTree`、`useAllRoles`、`useAllPositions`、`useDictItems`
- `queryFn` 引用的、会影响响应数据的变量必须进入 `queryKey`
- 官方 ESLint 插件 `@tanstack/eslint-plugin-query` 已启用；多查询聚合优先使用 `useQueries` 的 `combine` 生成稳定引用
- 成功提示由页面编排层负责；错误提示默认由 request 层处理，`silent` 调用需自行补提示

## 列表页模式

列表页统一使用 `useListSearch`。它整合分页状态、输入草稿态、已提交查询态，以及「查询 / 重置必须回源」的失效逻辑。

```tsx
const {
  page, pageSize, buildPagination,
  draftParams, setDraftParams, submittedParams,
  handleSearch, handleReset, applySearch,
} = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: xxxKeys.lists });

const listQuery = useXxxList({
  page,
  pageSize,
  keyword: submittedParams.keyword || undefined,
  status: submittedParams.status || undefined,
});
```

`applySearch(params)` 用于点击部门树、标签、收藏开关、保存视图等不经过输入框的筛选；它同步更新 draft 与 submitted，回到第一页并失效列表。不要暴露 `submittedParams` 的裸 setter。

表格接线：

```tsx
<ConfigurableTable
  bordered
  dataSource={listQuery.data?.list ?? []}
  loading={listQuery.isFetching}
  onRefresh={() => void listQuery.refetch()}
  refreshLoading={listQuery.isFetching}
  pagination={buildPagination(listQuery.data?.total ?? 0)}
/>
```

## 弹窗 / 抽屉懒加载

新增/编辑弹窗统一用 `useEditModal`。它负责打开状态、详情懒加载、表单校验、保存、成功提示、关闭与表单重挂载。

```tsx
const modal = useEditModal<Xxx, XxxValues>({
  entityName: '示例',
  save: useSaveXxx(),
  useDetail: useXxxDetail,
  defaults: { status: 'enabled' },
});

<AppModal {...modal.modalProps} width={660}>
  <Spin spinning={modal.detailLoading}>
    <Form key={modal.formKey} {...modal.formProps}>…字段…</Form>
  </Spin>
</AppModal>
```

注意：React 的 `key` 不能通过 spread 传入，必须显式写在 `<Form key={modal.formKey} ...>` 上。少数自持表单实例的页面可直接复用 `formRemountKey(id, detail)`。

`beforeSave` 用于跨字段校验或载荷转换；需要中断提交时先给用户提示，再调用 `abortSubmit()`。`successMessage` 返回 `null` 可关闭默认成功提示。

## 轮询、上传与下载

- **轮询**：用 Query 的 `refetchInterval`；条件轮询使用函数形式 `refetchInterval: (query) => hasRunning(query.state.data) ? 5000 : false`
- **上传进度**：`request.postForm(url, formData, { onProgress })` 包进 `mutationFn`，变量形如 `{ formData, onProgress }`
- **二进制读取 / 下载**：后台使用 `request.getBlob` / `request.download`；文件预览使用 `fetchManagedFileBlob`
- **导出**：列表导出优先使用 `ExportButton`，由 `useExportJobRunner` 接入导出任务

## 会员端（member SPA）

`src/member/` 是独立入口，使用 `memberQueryClient` 与 `memberRequest`。域 hooks 集中在 `member/hooks/queries.ts`，`unwrap` / `toQueryString` 从 `@/lib/query` 复用。会员端移动列表可使用 `useInfiniteQuery` 实现加载更多。

## 不走 TanStack Query 的场景

以下数据流保持命令式或本地状态：

- WebSocket / SSE / 流式：聊天消息流、进程 SSE、xterm 终端、Docker 日志、AI 流式回复
- 一次性动作：文件下载、验密、网络诊断类单发操作
- 与命令式组件深度耦合的数据流：如 db-admin 的 `useTableRowsInfinite`
- 本地优先且单属主的偏好系统：`hooks/PreferencesProvider.tsx`
- 认证前置流程：登录、重置密码、OAuth / 企业回调、OAuth2 授权页

只要是可缓存的读或会影响其他视图的写，就应进入域 hook。
