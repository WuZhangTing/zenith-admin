# 菜单与种子数据配置参考

本文档说明如何在 `seed-data.ts` 中添加新模块的菜单条目，以及在 `seed.ts` 中添加初始数据。

> **占位符约定**：`xxx` = 小写（表名、API 路径、文件名）；`Xxx` = 大驼峰（TypeScript 类型、组件名）。

---

## 菜单 ID 分段规则

菜单 ID 按**一级目录分段**管理，每个一级目录独占一个 **1000 段**（如系统管理 = 1000–1999、系统设置 = 2000–2999、CMS 内容管理 = 14000–14999）；平台级独立页占用 1–999（首页 = 1，个人中心 = 11，公告中心 = 12，我的消息 = 13）。

段内分配规则：

- **一级目录** = 段基数（如 `1000`）
- **子目录 / 页面菜单**：落在 **10 的倍数**槽位（如 `1010`、`1020`、`1030`…），按 `sort` 顺序排列
- **按钮**：紧跟父菜单 ID **顺延 +1..+n**（如页面 `1010` 的按钮为 `1011`、`1012`…）；按钮超过 9 个时自然占用后续 10 槽，下一个页面从其后最近的 10 倍数开始

在为新模块分配 ID 前，**必须先读取实际文件**了解当前分布：

```text
packages/shared/src/seed/{业务域}.ts   ← 查阅 SEED_MENUS 数组（含各段注释，如「─── 系统管理（1000 段）」）
```

典型查询方式：

- 新增**一级目录**：取当前最大段基数 + 1000
- 新增**页面**：在目标段内找到最后一个节点，从其后最近的 10 倍数槽位开始
- 新增**按钮**：父菜单 ID 顺延 +1

> **严禁**基于任何文档中记录的"当前最大 ID"来分配新 ID，这类记录必然滞后于代码。始终以源文件为准。

---

## 菜单与权限解耦（核心语义）

系统采用**显示与操作解耦**模型：

| 节点类型 | 职责 | `permission` 字段 |
| --- | --- | --- |
| `directory` / `menu` | **纯显示资源**（侧边栏分组 / 页面可见性） | **必须为空** |
| `button` | **纯权限点**（含「查询」），承载全部权限码 | 必填 |

- 每个页面菜单的**第一个按钮固定为「查询」**（`sort: 0`，权限码 `xxx:list`），控制页面数据加载；页面本身不带权限码
- 授权语义：勾选按钮**不会**带出所属页面（后端 `listUserMenuTree` 祖先补全只从目录/页面节点出发）；授权面板勾选页面时自动带上其「查询」按钮
- 典型场景：只授予「查询」按钮 = 仅 API 可用（跨页面下拉等），页面不可见

---

## Step 9：`packages/shared/src/seed/{业务域}.ts`

### 新增目录（一级菜单 / 二级目录，若需要）

```ts
// 一级目录 = 新 1000 段的基数（当前最大段基数 + 1000），纯显示资源，不带 permission
{ id: <段基数>, parentId: 0, title: 'XXX模块', name: 'XxxModule', icon: 'Layers', type: 'directory', sort: 99, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
```

### 新增菜单页面条目

```ts
// type: 'menu' — 可导航的页面（纯显示资源，不带 permission；列表权限码放在「查询」按钮上）
{ id: <10的倍数槽位>, parentId: <父目录ID>, title: 'XXX管理', name: 'SystemXxx',
  path: '/system/xxxs',
  component: 'xxxs/XxxPage',         // ← 必须精确匹配 packages/web/src/pages/ 下的文件路径，无扩展名
  icon: 'CircleDot',                  // ← lucide-react 图标名
  type: 'menu', sort: 10,
  status: 'enabled', visible: true,
  createdAt: SEED_DATE, updatedAt: SEED_DATE },
```

**`component` 字段规则**：

- 值 = 相对 `packages/web/src/pages/` 的路径，**无 `.tsx` 扩展名**
- 前端 `App.tsx` 用 `React.lazy(() => import(`../../pages/${m.component}`))` 动态加载
- 例：`component: 'users/UsersPage'` → `packages/web/src/pages/users/UsersPage.tsx`

### 新增按钮权限条目

```ts
// type: 'button' — 不可导航，只挂权限码；ID 从父菜单顺延 +1
// 第一个按钮固定为「查询」（sort: 0），承载页面的列表权限码
{ id: <菜单ID+1>, parentId: <菜单ID>, title: '查询', type: 'button', sort: 0, status: 'enabled', visible: true,
  permission: 'system:xxx:list', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: <菜单ID+2>, parentId: <菜单ID>, title: '新增XXX', type: 'button', sort: 1, status: 'enabled', visible: true,
  permission: 'system:xxx:create', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: <菜单ID+3>, parentId: <菜单ID>, title: '编辑XXX', type: 'button', sort: 2, status: 'enabled', visible: true,
  permission: 'system:xxx:update', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: <菜单ID+4>, parentId: <菜单ID>, title: '删除XXX', type: 'button', sort: 3, status: 'enabled', visible: true,
  permission: 'system:xxx:delete', createdAt: SEED_DATE, updatedAt: SEED_DATE },
```

### `name` 字段命名规范

- 一级目录：`XxxModule`
- 系统管理下的菜单：`SystemXxx`
- 独立模块菜单：`XxxManagement`
- 按钮：`undefined`

### `icon` 字段

统一使用 **lucide-react** 图标名（大驼峰），如 `CircleDot`、`LayoutList`、`BookOpen`。
可在 [https://lucide.dev/icons/](https://lucide.dev/icons/) 搜索。

---

## Step 10：`packages/shared/src/seed/{业务域}.ts` + `packages/server/src/db/seed.ts`

> **审计字段无需手填**：seed 脚本整体由 `runAsUser(adminId, ...)`（[`lib/audit-context.ts`](../../../../packages/server/src/lib/audit-context.ts)）包裹，所有 insert / update / onConflictDoUpdate 会被 db Proxy 自动注入 `createdBy = updatedBy = adminId`。**禁止**在种子数据数组中手动写 `createdBy` / `updatedBy`。

### Step 10a：先在 `shared/seed-data.ts` 声明常量

初始数据**必须**先放到 `packages/shared/src/seed/{业务域}.ts`，使 DB seed 和 MSW mock 共用同一份数据源：

```ts
// packages/shared/src/seed/{业务域}.ts（新增域时同步 seed/index.ts）
import type { ..., Xxx } from './types';  // 在顶部 import 中添加 Xxx

// ─── XXX 初始数据 ──────────────────────────────────────────────────────────────
export const SEED_XXXS: Xxx[] = [
  { id: 1, name: '示例XXX-1', description: '初始演示数据', status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 2, name: '示例XXX-2', description: '初始演示数据', status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
```

### Step 10b：在 `seed.ts` 中导入并插入

```ts
// packages/server/src/db/seed.ts — import 行追加：
import { ..., SEED_XXXS } from '@zenith/shared/seed';

// seedRest() 函数末尾追加：
// ─── 初始 XXX 数据（数据来源：@zenith/shared SEED_XXXS）─────────────────────
await db.insert(xxxs).values(
  SEED_XXXS.map(({ id, name, description, status }) => ({ id, name, description, status })),
).onConflictDoNothing({ target: xxxs.id });
await db.execute(sql`SELECT setval('xxxs_id_seq', GREATEST((SELECT MAX(id) FROM xxxs), 1))`);
logger.info('  ✔ Xxxs seeded (onConflictDoNothing)');
```

> **何时不需要 `setval`**：若不插入显式 `id`（完全使用 DB 自增），则不需要 `setval`。
> **何时不需要 shared 常量**：若 seed 数据与 mock 无关（如管理员密码、china-division 地区数据），可直接在 seed.ts 中写。

### 菜单种子更新方式

菜单是系统定义资源，`SEED_MENUS` 为**唯一权威来源**。seed.ts 对菜单采用**清空重建**策略（`TRUNCATE ... CASCADE` 后全量插入，绑定表与用户收藏一并重置后重新种入），**新增菜单只需维护 `SEED_MENUS`，重跑 `npm run db:seed` 即可生效**：

```ts
// packages/server/src/db/seed.ts（已有实现，无需改动；此处仅说明机制）
await db.execute(sql`TRUNCATE TABLE menus, role_menus, user_menus, tenant_package_menus RESTART IDENTITY CASCADE`);
await db.execute(sql`UPDATE users SET favorite_menus = NULL`);
const menuRows = SEED_MENUS.map((row) => ({ /* 字段映射 */ }));
await db.insert(menus).values(menuRows);
await db.execute(sql`SELECT setval('menus_id_seq', GREATEST((SELECT MAX(id) FROM menus), 1))`);
```

> 超管角色自动绑定全部菜单；其他角色按 `SEED_ROLES.menuIds` 绑定。角色/套餐引用菜单 ID 时**禁止硬编码魔法数字**，使用 `collectMenuSubtreeIds(rootId)` 等结构化推导（见 `seed-data.ts`）。

---

## 完整示例（以「部门管理」为参考）

```ts
// seed-data.ts 中的实际写法（系统管理 = 1000 段；实际 ID 请以源文件为准）
{ id: 1020, parentId: 1000, title: '部门管理', name: 'SystemDepartments',
  path: '/system/departments',
  component: 'system/departments/DepartmentsPage',
  icon: 'Building2', type: 'menu', sort: 2,
  status: 'enabled', visible: true,
  createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: 1021, parentId: 1020, title: '查询', type: 'button', sort: 0, status: 'enabled', visible: true,
  permission: 'system:department:list', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: 1022, parentId: 1020, title: '新增部门', type: 'button', sort: 1, status: 'enabled', visible: true,
  permission: 'system:department:create', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: 1023, parentId: 1020, title: '编辑部门', type: 'button', sort: 2, status: 'enabled', visible: true,
  permission: 'system:department:update', createdAt: SEED_DATE, updatedAt: SEED_DATE },
{ id: 1024, parentId: 1020, title: '删除部门', type: 'button', sort: 3, status: 'enabled', visible: true,
  permission: 'system:department:delete', createdAt: SEED_DATE, updatedAt: SEED_DATE },
```
