# 前端硬约束（Step 8）

前端层的「必须 / 禁止」清单，与 [constraints.md](./constraints.md)（后端与全局）互补，同一条规则只在一处维护。
写法模板见 [crud-frontend.md](./crud-frontend.md)、[query-cache.md](./query-cache.md)、[ui-patterns.md](./ui-patterns.md)。

| 改动涉及 | 章节 |
| --- | --- |
| 域 hooks、弹窗、搜索状态、提交与确认 | [必须复用的公共 hook / 工具](#必须复用的公共-hook--工具) |
| mutation 失效、query key、下拉源、回填 | [缓存与 query key](#缓存与-query-key) |
| 搜索栏、筛选控件、表格与操作列 | [搜索栏与表格](#搜索栏与表格) |
| 弹窗表单、枚举标签、上传、时区、进度条、滑块、分割线 | [表单与展示组件](#表单与展示组件) |
| 多 Tab、左右分栏、统计卡、栅格、抽屉宽度、行内成组间距 | [布局与响应式](#布局与响应式) |

---

## 必须复用的公共 hook / 工具

漏写这些封装焊死的契约时**不会报错**，只会表现为界面行为异常，因此一律不得手抄等价实现。

| 场景 | 必须使用 | 禁止的手写实现 | 漏写的代价 |
| --- | --- | --- | --- |
| 标准 CRUD 域 hooks | `lib/crud-queries.ts` 的 `createCrudQueries` | 手抄 `xxxKeys` 与列表 / 详情 / 保存 / 删除；下拉源也应通过工厂按需开启 | 保存后列表不变；已删记录重新打开弹窗时闪出旧数据 |
| 新增 / 编辑弹窗 | `hooks/useEditModal.ts` | `useRef<FormApi>` + `editingRecord` + `try { validate() } catch` + `Toast` + 关闭四件套 | 确定按钮永远转圈；异步详情进不了表单；下次「新增」带出上次记录 |
| 列表页搜索状态 | `hooks/useListSearch.ts` | `draftParams` / `submittedParams` 双状态 + `handleSearch` / `handleReset` | 条件未变时点「查询」不回源，且列表仍有数据、不报错 |
| 树形表格展开态 | `hooks/useTreeExpansion.ts` | 递归收集节点 key + `isAllExpanded` 计数比较 + `onExpandedRowsChange` 行→key 映射 | 传未筛选数据时按钮显示「全部展开」却点不动（死按钮）；数据清空后空表格显示「全部折叠」 |
| 中断表单提交 | `lib/abort-submit.ts` 的 `abortSubmit()`（先给用户提示再调用） | `return`、`throw new Error('多词消息')` | 按钮一直转圈；或多弹一个「操作失败：xxx」并向 `/api/frontend-errors` 灌入假告警 |
| 破坏性操作确认 | `utils/confirm.ts` 的 `confirmDelete` / `confirmDanger` | `Modal.confirm({ okButtonProps: { type: 'danger', theme: 'solid' } })` | 「确定删除」与「确定提交」渲染成同一个蓝色主按钮 |

各症状的完整诊断见 [troubleshooting.md](./troubleshooting.md)。

补充判定：

- `createCrudQueries` 覆盖标准 CRUD 与可选 lookup；域内非标准接口（分配菜单、导入导出、状态切换）继续手写
  `useMutation`，用工厂导出的 `keys` 做失效。**禁止**为了套用工厂去改后端接口形状
- `useEditModal` 的例外（页面级全局配置表单、认证流程、工作流设计器与运行时表单、db-admin 行编辑器、
  保存后不关闭的搭建器工作区）需写注释说明理由；若该表单同时配了详情查询，`<Form>` 的 `key`
  **必须**用 `formRemountKey(id, detail)`
- 不经输入框直接筛选（点部门树 / 标签 / 收藏 / 保存的视图）用 `useListSearch` 的 `applySearch(params)`；
  **禁止**暴露 `submittedParams` 的裸 setter（会绕过页码重置与失效）
- **非破坏性确认**（提交、发布、启用、退出、导出）继续用原生 `Modal.confirm`，不加 danger；
  删除文案**不做统一**，指明对象的具体文案比通用文案更能防误操作

## 缓存与 query key

判定推论、策略表与 key 树设计见 [query-cache.md](./query-cache.md)，硬约束：

- **精确失效**：`onSuccess` 按真实副作用失效，**禁止**无条件 `invalidateQueries({ queryKey: xxxKeys.all })`；
  判据是「有没有已挂载的查询读了这次被改动的状态」。删除用 `removeQueries(detail(id))`；
  确需全域失效（批量覆盖、切租户、全量导入）须在注释写明理由
- **key 结构**：`xxxKeys.all` 只能是本域自己的根；独立生命周期的子资源另起命名空间；
  多变体查询导出 `detailOf(id)` / `dataOf(id)` / `lookupPrefix` 前缀键；
  静态 lookup、数据库元数据与昂贵派生取数不与列表同前缀
- **下拉源归属所有者域**：**禁止**用本域 key 请求别域资源（所有者域增删改时无人失效它，界面静默显示旧列表），
  一律复用 `useAllRoles` / `useFlatDepartments` / `useAllUsers` / `useAllPositions` / `useDictItems` 等共享 lookup hook
- **手写 mutation 的回填红线**：`setQueryData(detail(id), saved)` 仅限写接口与详情接口同源；详情按查看者脱敏、
  详情多出关联数据、写接口不回传编辑过的关联字段、列表 / 树含聚合字段这四种情形**必须**改为失效 `detail(id)`
- **失效行为需可证伪**：测试用 `test-utils/query-harness.ts` 断言实际请求数、进入 fetching 的查询与缓存新鲜度；
  **禁止**只 spy「调用了 `invalidateQueries(某 key)`」——`all` 是 `detail` 的前缀，冗余的广播写法下同样通过
- **轮询**用 `refetchInterval`，禁止手写 `setInterval` 拉数据

## 搜索栏与表格

- **搜索栏布局**：统一用 `components/SearchToolbar.tsx`。筛选 / 操作较多时必须使用结构化模式
  （`primary` / `filters` / `actions`，必要时 `mobilePrimary` / `mobileFilters` / `mobileActions` 覆盖移动端）；
  移动端至少露出一个高频搜索 / 筛选项（优先关键词）、查询与新增，其余筛选进底部抽屉、低频操作进更多菜单
- **筛选控件**：关键字 / 状态 / 时间范围统一用 `components/search-filters.tsx` 的
  `KeywordInput` / `StatusSelect` / `DateRangeFilter`，**禁止**手写 `prefix={<Search size={14} />}`、
  `showClear`、`style={{ width: N }}` 这类装饰性属性；业务属性仍显式传入。
  **例外**：面板 / 弹窗内需跟随容器自适应的搜索框（如 `NavListPanel` 的 List header）不套用
- **公共按钮**：查询 / 重置 / 新增 / 刷新统一用 `components/toolbar-controls.tsx` 的
  `SearchButton` / `ResetButton` / `CreateButton` / `RefreshButton`，文案不同时用 children 覆盖。
  **例外**：仅复用同一图标的独立操作（「测试发送」「生成链接」）及视觉本就不同的写法保持原生 `Button`
- **移动端更多菜单**：`mobileActions` 只放低频操作；普通按钮用 `theme="borderless"`
  （危险操作保留 `type="danger"`），导出优先 `ExportButton variant="flat"`
- **表格样式**：统一 `<ConfigurableTable bordered ... />`；必须传 `onRefresh` 与 `refreshLoading`
  （统一取 `listQuery.isFetching`），否则工具栏不显示刷新按钮
- **操作列**：一律经 `components/ResponsiveTableActions.tsx` 的 `createOperationColumn` 创建；
  动作只用纯文字 `label`（不加图标），危险操作加 `danger: true`，
  桌面端可用 `desktopInlineKeys` 保留高频动作内联
- **操作列宽度**：新增 / 修改动作后必须复核 `width`，算法见
  [ui-patterns.md → 操作列宽度估算](./ui-patterns.md#操作列宽度估算)。
  速算：按钮宽 = 24 + 文字宽（汉字 14px/字），加 4px 间距，有「更多」再加 22，最后加 32 单元格 padding。
  内容宽按**能同时出现**的动作算（权限条件取全为真，状态互斥的分支取最大值，不要相加）。
  **禁止**列宽小于内容宽——单元格无 `overflow: hidden`，不会报错也不会截断，
  而是吃掉 padding 并挤压相邻固定列。估算超过 280px 时改用 `desktopInlineKeys` 收进「更多」，不要一味加宽。
  「编辑 / 删除」这一最常见组合统一取 `width: 130`
- **状态列固定**：状态列必须紧靠操作列左侧，并同样 `fixed: 'right'`
- **列公共工具**：`createdAtColumn` 与 `renderEllipsis` 从 `utils/table-columns` 导入；
  **禁止**内联写 `<Typography.Text ellipsis={{ showTooltip: true }} …>`
- **时间 / 日期列**：一律用 `utils/table-columns` 的 `dateTimeColumn(title, dataIndex, options?)`
  （日期时间，宽 180）或 `dateColumn(...)`（纯日期，宽 120）创建，`createdAt` / `updatedAt`
  直接用预置的 `createdAtColumn` / `updatedAtColumn`。工厂已内建格式化与空值兜底，
  **禁止**再手写 `width` 与 `render: (v) => formatDateTime(v)` / `v ? formatDateTime(v) : '-'`。
  语义化空值（「永久」「不限」「未发布」）传 `empty`；unix 秒时间戳传 `unit: 'second'`；
  紧凑表格的字号 / 弱化色传 `className`（`table-cell-compact` / `table-cell-muted`），
  **禁止**为此包一层 `Typography.Text size="small"`；`sorter` / `fixed` 等直接透传。
  判定依据是**字段语义**而非列标题：`xxxAt` / `xxxTime` 一律走工厂，
  哪怕标题是「最近活跃」「下次执行」这类业务措辞。
  时间列不承载副文案与装饰：图标 / 等宽字体一律去掉，「清理 N 行」这类附加信息拆成独立列。
  只有时间**区间**（一格渲染起止两个值）与真正的复合列可保留自定义 `render`，
  此时 `width` 也必须取 `DATE_TIME_COLUMN_WIDTH`
- **空值占位统一**：用 `utils/table-columns` 的 `EMPTY_PLACEHOLDER`（`—`），**禁止**混用 `-` / `–`
- **树形表格展开控制**：用 `children` 渲染树形表格时必须在搜索栏加「全部展开 / 全部折叠」按钮，
  展开态一律用 `hooks/useTreeExpansion.ts`（受控 `expandedRowKeys` + `onExpandedRowsChange` 由它提供）；
  图标已展开用 `ChevronsDownUp`，未展开用 `ChevronsUpDown`。
  **传入的必须是表格实际渲染的数据**（筛选后的那份），传全量树会让筛选后的按钮点不动。
  只有部分行可展开或行 key 不是 `id` 时，用 `collectKeys` / `getRowKey` 覆盖
- **批量按钮显示时机**：仅 `selectedRowKeys.length > 0` 时显示，放在查询 / 重置按钮之后

## 表单与展示组件

- **弹窗表单**：`Form` 必须 `labelPosition="left"`，所有 `Modal` 必须 `closeOnEsc`
  （经 `useEditModal` 时已由 `formProps` / `modalProps` 提供）；`labelWidth` 与单列 / 双列的选取规则见
  [crud-frontend.md](./crud-frontend.md)
- **枚举标签统一来源**：**禁止**在页面 / 组件 / 导出定义中内联 `{ value, label }` 数组或
  `Record<value, label>` 中文映射。按优先级取：

  | 枚举性质 | 来源 |
  | --- | --- |
  | 运营可扩展的自由文本枚举 | 字典 `useDictItems('code')`（种子在 `shared/src/seed/platform.ts`） |
  | 通用启用 / 禁用 | `useDictItems('common_status')`（前端）/ `COMMON_STATUS_LABELS`（server，`@zenith/shared/core`） |
  | 代码耦合枚举（pg enum / 状态机 / 协议值） | `shared/src/{业务域}/constants.ts` 的 `XXX_LABELS` / `XXX_OPTIONS` |
  | 工作流实例 / 任务状态 | `components/workflow/workflow-runtime.ts` 的 `INSTANCE_STATUS_MAP` / `TASK_STATUS_MAP` |

  Tag 颜色、图表色板、CSS 变量留在使用方；外部协议值（如微信 `sex: '1'/'2'`）
  与视角特化文案（如「我已同意」）不做统一
- **单图上传字段**：统一用 `components/ImageUploadField.tsx`，**禁止**重新拼
  `<Upload action headers>` + 预览 `<img>` + 删除按钮
- **时区表单字段**：统一用 `components/FormTimezoneSelect.tsx`；默认必填，自定义字段名 / 标签传
  `field` / `label`，允许留空并回退默认时区时传 `required={false}`。页面内的默认值、提交兜底和比较逻辑
  统一复用 `utils/timezones.ts` 的 `DEFAULT_TIMEZONE`；**禁止**使用 `Form.Input`、自行拼
  `Form.Select optionList`、直接调用 `Intl.supportedValuesOf('timeZone')` 或硬编码 `Asia/Shanghai`
- **进度与度量条语义**：前三类**禁止**手写 `width: '${percent}%'` / `scaleX(percent)` 轨道

  | 数据性质 | 用 |
  | --- | --- |
  | 真实进度（上传、异步执行、目标完成） | Semi `Progress`；任务中心优先 `AsyncTaskProgress` |
  | 有界测量（CPU / 内存 / 配额 / 评分） | `components/data-viz/MetricMeter` |
  | 相对数据条（排行、占比、分布） | `components/data-viz/DataBar`，且必须有相邻可见数值文本 |
  | 无确定百分比 | `Spin`；路由顶部不定加载用 `NProgress` |

  分段构成、时间轴、漏斗等本身承载结构的可视化不套用本条
- **滑块与精确输入联动**：有明确上下界、适合拖动预览且仍需精确输入的数值字段统一用
  `components/SliderInput` 的 `FormSliderInput`（表单内）/ `SliderInput`（受控）。
  金额、ID、配额、Cron、重试次数、保留天数及需 0.01 精度的费率 / 分账比例继续用 `InputNumber`
- **分割线**：统一用 Semi `Divider`，**禁止**用 `<hr>`、空 `<div>` 配 `borderTop` / `borderBottom`、
  `height: 1px` + `background`，或 `::before` / `::after` 伪元素手绘线条

  | 形态 | 写法 |
  | --- | --- |
  | 横向分隔 | `<Divider />`。上下间距对称用 `margin={16}`；不对称才用 `style={{ margin: '14px 0 10px' }}`——`margin` prop 只接受单值并同时写上下 |
  | 竖向分隔（工具栏、行内元素之间） | `<Divider layout="vertical" margin="4px" />`。默认高 20px，要别的高度传 `style={{ height: 16 }}` |
  | 线 + 文字 + 线（分区小标题） | `<Divider align="left">标题</Divider>`（`left` 前导线 40px / `center` 居中 / `right`），**禁止**用三段 `span` 或 flex 拼 |
  | 下拉菜单项之间 | `<Dropdown.Divider />`，不是 `Divider` |

  换配色 / 字号时覆盖 Semi 类名（`.semi-divider-with-text::before` / `::after` 的
  `border-bottom-color`，文字用 `.semi-divider_inner-text`），**禁止**因为要改样式就退回手写。
  **不适用**（这些不是分割线，改用 `Divider` 反而会坏）：面板 header / footer 自身的分区边框
  （`borderTop` + `padding` 且元素内部有内容）、时间轴 / 步骤条的连接线、需要绝对定位或按相邻
  状态条件隐藏的分隔符

## 布局与响应式

写法见 [ui-patterns.md](./ui-patterns.md)。

| 场景 | 必须使用 | 关键判定 |
| --- | --- | --- |
| 页面最外层是多个业务 Tab | `<div className="page-container page-tabs-page">` | 每个 `TabPane` 内自带该 tab 的工具栏、操作按钮、空状态与表格；**禁止**把 TabPane 留空后在 Tabs 外部按 `activeTab` 渲染共用表格 / 按钮。抽屉、弹窗、卡片内代码示例、分栏内部小 tabs 不用 |
| 左侧列表 / 筛选树 + 右侧详情 | `components/MasterDetailLayout.tsx` | **禁止**手写 flex 两栏 |
| 左侧 master 是平铺列表（非树形） | `NavListPanel<T>` + `NavListItem` | 树形数据（需展开 / 折叠）改用 Semi `Tree` |
| 指标卡（数值 + 标题） | `components/charts/StatCard.tsx` 的 `StatCard` + `StatGrid` | **禁止**再写 `<Card>` + 大字号数值 + tertiary 标签的组合 |

- **Tabs 自动溢出折叠**：所有 `<Tabs>` 必须带 `collapsible="auto"`——窄容器（抽屉、弹窗、
  分栏面板）里标签多时会折行或被裁掉，`auto` 只在真放不下时折叠成带箭头的滚动条，
  宽度充足时渲染与不加时一致，因此**没有「这个页面标签少所以不用加」的例外**。
  **禁止**裸写 `collapsible`（等价 `true`，无论宽度是否够都常驻箭头）。
  **不适用**：`tabPosition="left"` / `"right"` 的纵向 Tabs——折叠实现是横向
  `OverflowList`，套到纵向布局上会坏掉
- **分栏的窄屏契约**：窄屏（**容器**宽度 < `responsiveBreakpoint`，默认 720）自动转单栏，
  必须提供返回入口——master 为列表传 `onBack`，master 为筛选树、detail 才是主体时传 `onMasterBack`；
  且**禁止**在单栏下自动选中首项（否则根视图落在详情），用 `onResponsiveChange` 区分
- **分栏位置切换**：桌面端默认允许调换 master 左右位置；master 使用 `MasterDetailLayout.Header` 或
  `NavListPanel` 时按钮自动出现，业务页面**禁止**重复渲染 `SideToggle`。窄屏自动隐藏；
  传 `persistKey` 时宽度与位置一并持久化；明确不允许调换的页面传 `sideSwitchable={false}`
- **StatCard 的导入路径**：页面无图表时从 `@/components/charts/StatCard` 直接导入——
  桶文件 `@/components/charts` 会连带引入约 2MB 的 vchart
- **栅格禁止内联写死列数**：**禁止** `style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}` 或 `'1fr 1fr'`——
  内联样式无法被媒体查询覆盖，窄屏会把内容压到竖排。按场景选：统计卡片 → `StatGrid`；
  图表分栏 → `.chart-grid`；其余固定列数栅格 / 表单多列 / 选择器 → `global.css` 的 `.auto-grid`
  （`--auto-grid-cols` 不可省，纯 `auto-fit` 会在宽屏多拆一列）。
  确需保留的 `repeat(auto-*, minmax(Npx, 1fr))` 必须写成 `minmax(min(Npx, 100%), 1fr)`。
  **不适用**：固定像素列的标签 / 值布局、等分小方块缩略图、本身处于固定宽容器内的微指标
- **抽屉 / 弹窗宽度**：窄屏适配已由 `global.css` 全局兜底，**无需**再写
  `width={isMobile ? '100%' : 720}`——该判断在所有区间都被全局规则覆盖，是无效代码
- **行内成组间距用 `Space`；禁止拿它改写已有的 flex 布局**：新写「图标 + 文字」
  「头像 + 姓名」「若干小按钮」这类行内成组时用 `<Space spacing={n}>`（表格操作列固定
  `spacing={4}`，见 [ui-patterns.md → 度量常量](./ui-patterns.md#度量常量)）。
  已有的 `style={{ display: 'flex', gap }}` **一律不动**——`Space` 只吸收 `display` /
  `gap` / `alignItems` / `flexDirection` / `flexWrap` 五个属性，换不掉的情况占绝大多数：

  | 情况 | 为什么不能换 |
  | --- | --- |
  | 样式里有 `justifyContent` | `Space` **没有** `justify` prop，`space-between` / 靠右都表达不了 |
  | 原本是块级 `display: 'flex'` | `Space` 是 `inline-flex`，会从撑满变收缩包裹；补 `style={{ display: 'flex' }}` 等于把省下的又写回去 |
  | 还留着 `padding` / `margin` / 背景 / 字号 | `style` 照样在，只少三个属性，收益不抵回归风险 |
  | 元素带 `aria-*` | `Space` 只透传 `data-*`（`getDataAttr`），`aria-label` 会被**静默丢掉** |
  | flex 样式挂在 `Typography.Text` 等组件上 | 换 `Space` 要么丢组件语义，要么多套一层，反而更长 |

  两处默认值差异必须显式处理：`Space` 默认 `align="center"`，而原生 flex 不写 `alignItems`
  时是 `stretch`——纵向布局下 `stretch`（子元素撑满宽度）与 `center` 观感完全不同，
  这种情况传 `align="start"`。`spacing` 预设只有 `tight` 8 / `medium` 16 / `loose` 24，
  其余直接写 `spacing={6}` 这类数字；`flexWrap: 'nowrap'` 无需映射（`Space` 默认即不换行）

---
