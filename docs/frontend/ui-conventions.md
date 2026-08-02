# UI 规范

前端采用 **Semi Design**（`@douyinfe/semi-ui`）作为组件库，图标统一使用 **lucide-react**，页面结构与交互节奏在全站保持一致。

::: tip 硬性约束不在本页
「必须用哪个组件、哪些写法被禁止」这类可机械核对的规则，统一维护在
[`.agents/skills/zenith/references/constraints.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)，
可直接复制的完整页面模板在
[`crud-frontend.md`](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/crud-frontend.md)。
规范只有一个来源，本页只讲**设计取向**和**去哪查**。
:::

## 规范索引

| 你要做的事 | 去哪查 |
| --- | --- |
| 列表页搜索区、表格、操作列、状态列必须用什么 | `constraints.md` → 前端层（Step 8） |
| 上面这些具体怎么写（含结构化 `SearchToolbar`、移动端覆盖） | `crud-frontend.md` → 完整页面模板 |
| 弹窗表单：必须加 `labelPosition="left"` / `closeOnEsc` | `constraints.md` → 前端层（Step 8） |
| 弹窗表单：`labelWidth` 取值与单列 / 双列怎么选 | `crud-frontend.md` → 弹窗表单布局规范 |
| 查询 / 重置 / 新增 / 刷新按钮 | `constraints.md` → 搜索栏公共按钮；API 见 [组件文档](/frontend/components#toolbar-controls-查询-重置-新增-刷新按钮) |
| 关键字输入 / 状态下拉 / 时间范围等筛选控件 | [组件文档 → search-filters](/frontend/components#search-filters-关键字-状态-时间范围筛选)；仅关键字的列表页可直接用 `KeywordSearchToolbar` |
| 时间格式、分页格式、图标库 | `constraints.md` → 全局章节 |
| 完整列表页代码模板（域 hooks、批量操作、虚拟化表格、左右分栏、左侧平铺列表） | `crud-frontend.md` |
| mutation 失效粒度、query key 结构、能否回填详情 | `crud-frontend.md` → 缓存一致性契约 |
| 枚举标签从哪来（字典 / shared constants） | `constraints.md` → 枚举标签统一来源 |

> 分工是固定的：**`constraints.md` 只写「必须 / 禁止」这类一句话可核对的断言，
> `crud-frontend.md` 写代码怎么落地**。查约束去前者，查写法去后者。

## 页面设计原则

这几条是取向判断，没法机械核对，也不适合写成约束条目：

- **信息层次清晰，高频操作易于触达**。列表页优先考虑操作效率，不过度装饰
- **保持后台系统的稳定感**。新页面尽量沿用已有布局与交互节奏，不要为单个页面发明新的交互范式
- **移动端做减法而非等比缩小**。只露出关键词搜索和最高频的一两个入口，其余筛选进底部抽屉、低频操作进更多菜单——判断哪个筛选项"最高频"需要结合业务，这是设计决策而非规则
- **表单校验走声明式**。用 Semi Form 的 `rules` 声明，而不是在提交回调里手写 if-else，让错误提示的位置和时机保持一致

## 相关文档

- [公共组件](/frontend/components)：`ConfigurableTable`、`SearchToolbar`、`toolbar-controls`、`search-filters` 等组件的 Props 与用法
- [数据获取与服务端状态](/frontend/data-fetching)：TanStack Query 分层、域 hooks 约定、列表页模式
- [前端路由与菜单](/frontend/routing)：动态菜单路由、路由守卫、新增页面的完整流程
- [认证与请求](/frontend/auth-request)：AuthProvider、HttpClient 三端实例、token 管理
