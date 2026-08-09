# 前端路由与菜单

本页介绍 Zenith Admin 前端路由的注册机制、动态菜单工作原理及路由守卫逻辑。路由全部装配在 `packages/web/src/App.tsx`。

---

## 整体路由策略

项目使用 `react-router-dom v7`，路由分为两类：

- **固定路由**：硬编码在 `App.tsx` 中，例如 `/login`、`/profile`、`/workflow/designer/:id` 这类无需登录、带路径参数或需要额外权限判断的页面
- **动态路由**：从后端 `/api/menus/user` 接口获取当前用户可见的菜单树，按权限动态注册，例如 `/system/users`、`/system/roles`

浏览器环境使用 `BrowserRouter`，`basename` 读取 `import.meta.env.BASE_URL`，自动适配 GitHub Pages 等子路径部署；Electron 环境（`VITE_ELECTRON=true`）因 `file://` 协议限制使用 `HashRouter`。

## 登录态分流

`App.tsx` 顶层通过 `useAuth()`（由 `providers/AuthProvider.tsx` 提供，见[认证与请求](/frontend/auth-request)）读取认证状态，按 `status` 分流：

| status | 渲染结果 |
| --- | --- |
| `checking` | 全屏加载点（本地有 token，正在请求 `/api/auth/me` 确认会话） |
| `unavailable` | `FullPageRetry` 重试页——凭证保留，不误清登录态；按离线/连接失败/服务端异常/维护中区分文案，离线感知 + 指数退避自动重试，并提供「重新登录」出口。已失败过的会话查询在重试期间保持本状态（不回落 `checking`），避免整页闪回加载点 |
| `anonymous` | 匿名路由表：登录页、重置密码页、OAuth 回调等 |
| `authenticated` | `AdminRouteLoader`：加载菜单并装配后台路由 |

`checking` 与 `unavailable` 在 Router 之前就返回，二者统一由 `AppChrome` 包裹（`ThemeProvider` + `ElectronTitleBar`），
否则深色模式用户会先看到一屏纯白，Electron 窗口也会缺掉标题栏而无法拖动关闭。

### 匿名可访问的路由

- `/login`：登录页
- `/reset-password`：重置密码页
- `/oauth/callback/:provider`：OAuth 第三方登录回调页
- `/enterprise/callback`：企业身份源回调页
- `/oauth2/authorize`：OAuth2 授权同意页
- `/public/payment/link/:token`：支付收银台公开页
- `/public/report/:token`：公开分享的报表看板
- 其他路径 → 重定向 `/login`，并以 `redirect` query 保留来源路径

### 已登录访问认证页

- `/login` → 跳转到合法的 `redirect` 目标（须以 `/` 开头、非 `//`、非 `/login`），否则回首页；避免落入 catch-all 404 并出现在多标签栏
- `/reset-password` → 跳转首页

---

## 动态菜单路由注册流程

```text
登录成功（AuthProvider 写入 token、拉取 /api/auth/me）
    ↓
App.tsx 渲染 AdminRouteLoader
    ↓
两个 TanStack Query 并行加载（hooks/queries/menus.ts，staleTime 5 分钟）：
  useCurrentUserMenuTree() → GET /api/menus/user   当前用户可见菜单树
  useMenuTree()            → GET /api/menus        完整菜单树（403/404 判别用）
    ↓
首载 gate：任一查询 isPending 时显示加载点；后台 refetch 保留旧数据不闪屏
    ↓
flattenMenus()：扁平化用户菜单树，只保留「有 path 且有 component」的节点，
并跳过 FIXED_ROUTES 中的路径（避免与固定路由重复注册）
    ↓
lazyPageComponent(m.component)（utils/page-registry.ts）解析出懒加载组件
    ↓
在 <Routes> 中动态注册 <Route>；侧边栏菜单树来自同一数据，与路由天然一致
```

### 菜单数据的加载失败语义

- **用户菜单树失败**：渲染整页「导航菜单加载失败」重试页。空菜单渲染会把网络故障伪装成「全部页面 404」，因此必须显式可重试
- **完整菜单树失败**：不阻塞页面，仅降级 catch-all 的 403 → 404 判别

### 权限变更即时生效

角色授权、用户授权、用户组角色、租户套餐等 mutation 成功后，域 hooks 调用 `invalidateCurrentUserAccess(qc)`（`hooks/queries/menus.ts`）统一失效 `['menus', 'user-tree']` 与 `['auth', 'me']`——当前登录者的侧边栏、动态路由与权限码快照随之刷新，无需重新登录。

### 菜单 `component` 字段与页面注册表

菜单表中 `component` 字段存储**相对于 `packages/web/src/pages/` 的文件路径**（不含 `.tsx` 后缀），例如 `/system/users` → `system/users/UsersPage`。

解析统一走 `src/utils/page-registry.ts`：

- 用 `import.meta.glob(['../pages/**/*.tsx', '!../pages/**/**Skeleton.tsx'])` 收集全部页面组件
- `lazyPageComponent(component)` 返回缓存过的 `React.lazy` 组件；路径不存在返回 `null`（路由跳过注册并 console.warn）
- 该注册表同时供工作流「自定义业务表单」（`components/workflow/BusinessFormHost.tsx`）复用

### 外链内嵌菜单

`isExternal + embed` 的菜单不会新窗口打开，而是注册为内部路由 `/embed/{菜单id}`，由 `EmbedPage` 以 iframe 嵌入目标地址。

---

## 路由守卫

### 无权限保护（403 / 404 判别）

访问未注册路由时命中 `*` 通配路由 `NotFoundOrForbidden`。它用完整菜单树构建的 `path → component` 映射（`buildAllMenuPaths`）做**前缀匹配**（如 `/system/users/123` 匹配 `/system/users`）：

- 路径对应页面存在、但用户菜单未注册 → **403**
- 路径不存在 → **404**
- 固定路由与 `/` 不参与 403 判别

::: warning 页面级权限只能由动态菜单承载
不要为菜单页面在 `App.tsx` 里另写无守卫的硬编码 `<Route>`。React Router 对同一静态路径按声明顺序取先者，硬编码版本会遮蔽动态菜单的权限过滤，未授权用户可直接打开页面（`/system/ssl-certificates` 曾因此产生授权缺口）。`src/App.routes.test.tsx` 对该策略做了防回潮回归。
:::

### 带权限判断的固定路由

少数固定路由无法由菜单承载（带路径参数），在 `App.tsx` 中用 `usePermission()` 的权限码内联判断，无权限渲染 `ForbiddenPage`：

| 路由 | 要求权限（或 `*`） |
| --- | --- |
| `/report/fill/:code` | `report:fill:record:create` 或 `report:fill:record:update` |
| `/system/firewall` | `system:firewall:view` |
| `/system/nginx-sites` | `system:nginx:view` |
| `/system/oauth2-apps/:id` | `system:oauth2-apps:view` |

### 按钮级权限

按钮级权限通过 `PermissionContext` + `usePermission` 实现。权限码来自 `/api/auth/me` 响应，由 `AuthProvider` 注入 context：

```tsx
import { usePermission } from '@/hooks/usePermission';

const { permissions, hasPermission, hasAnyPermission } = usePermission();

// 只有拥有 'system:user:create' 权限（或超管通配 '*'）的用户才能看到「新增」按钮
{hasPermission('system:user:create') && (
  <CreateButton onClick={openCreate} />
)}
```

`hasPermission` / `hasAnyPermission` 引用稳定，可安全作为 `useMemo` / `useCallback` 依赖。

---

## 系统内置路由

以下路由为固定注册，与菜单数据库无关（需登录，除非另有说明）：

- `/`：首页入口 `HomeEntry`——登录落地时一次性应用「默认首页」偏好（`homePath` 指向其他页面则跳转）；日常手动访问 `/` 始终进入仪表盘
- `/profile`：个人中心
- `/announcements`：公告中心
- `/inbox`：我的消息
- `/workflow/designer/:id`：工作流设计器
- `/workflow/launch/:definitionId`：工作流发起页
- `/workflow/instance/:id`：流程实例详情页
- `/report/dashboards/:id/design`：看板设计器
- `/report/dashboards/:id/view`：看板查看页
- `/report/print/:id/design`：打印模板设计器
- `/report/fill/:code`：填报入口（带权限判断）
- `/system/firewall`、`/system/nginx-sites`、`/system/oauth2-apps/:id`：带权限判断，见上表
- `/public/ai-chat/:token`：公开 AI 对话分享页
- `/oauth2/authorize`、`/enterprise/callback`、`/public/payment/link/:token`、`/public/report/:token`：独立页面，不在后台布局内（登录与否均可访问）
- `/users`：重定向到 `/system/users`
- `/forbidden`：无权限提示页

其中 `/profile`、`/announcements`、`/inbox`、`/system/firewall`、`/system/nginx-sites` 同时存在于系统菜单（隐藏项或运维菜单）中，因此被收录进 `App.tsx` 导出的 `FIXED_ROUTES` 集合——`flattenMenus` 会跳过这些路径，避免菜单数据重复注册。

---

## 标签页（Tab）管理

后台布局中包含多标签页导航（`hooks/useTabsStore.ts` + `layouts/AdminLayout.tsx`），用户访问过的页面以 Tab 形式保留在顶部。

**右键上下文菜单**支持：固定/取消固定、关闭当前、关闭其他、关闭左侧、关闭右侧、关闭全部。

- 排序固定为 `首页 → 固定标签 → 普通标签`；支持拖拽排序，但固定区与普通区不可跨区混排
- 达到最大标签数（偏好 `tabsMaxCount`）时按 FIFO 或 LRU 策略自动淘汰可关闭标签
- 开启「保持标签页」偏好后，标签状态持久化到 `localStorage` 的 `zenith_tabs`（key 常量 `TABS_STORAGE_KEY` 来自 `@zenith/shared/core`）；关闭该偏好时仅保存在内存中

---

## 路由加载性能

- **AdminLayout 懒加载**：后台布局的静态依赖图很重（通知、文件预览、偏好面板、dnd-kit 等），登录页与公开页（支付链接、公开报表、OAuth 授权）不预载它
- 所有固定页面与动态页面组件均为 `React.lazy` + `<Suspense>` 懒加载；仪表盘首页使用 `DashboardSkeleton` 专用骨架屏（图表行 `DashboardCharts` 在页面内再次懒加载），其余页面使用轻量加载点占位
- 后台布局内置 `NProgress` 顶部路由切换进度条（可通过偏好 `showProgressBar` 关闭）
- **chunk 加载失败自动恢复**：`PageErrorBoundary` 识别动态模块加载失败（网络中断或发版后旧产物被清理），提示「页面资源加载失败」，点击重新加载执行**整页刷新**拉取最新产物——浏览器已缓存 rejected 的 module promise，仅重置边界状态会立即再次失败

---

## pages 目录结构

`packages/web/src/pages/` 下的一级目录包括：

```text
ai            analytics     announcements  biz           chat
cms           dashboard     embed          forbidden     inbox
login         member        mp             not-found     oauth
oauth2        open-platform payment        profile       public-ai-chat
report        reset-password rules         system        users
workflow
```

---

## 新增页面的完整流程

1. 在 `packages/web/src/pages/<module>/<ComponentName>.tsx` 创建页面组件
2. 在 `menus` 表中新增菜单记录，`component` 字段填写相对路径（如 `<module>/<ComponentName>`）——通过种子数据（`@zenith/shared/seed`）或「菜单管理」后台页面创建，并为角色分配权限
3. 刷新页面，动态路由自动注册，侧边栏自动显示新菜单

完整的 CRUD 开发流程（含菜单/权限种子配置）见 [`.agents/skills/zenith/SKILL.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/SKILL.md)。
