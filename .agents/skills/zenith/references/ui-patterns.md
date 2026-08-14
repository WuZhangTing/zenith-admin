# 前端布局与展示组件

标准列表页之外的页面结构写法。约束条目见 [constraints-frontend.md → 布局与响应式](./constraints-frontend.md#布局与响应式)，
标准列表页模板见 [crud-frontend.md](./crud-frontend.md)。

| 需求 | 章节 |
| --- | --- |
| 页面最外层是多个业务 Tab | [页面级多 Tab 布局](#页面级多-tab-布局) |
| 左侧列表 / 筛选树 + 右侧详情 | [左右分栏（MasterDetailLayout）](#左右分栏masterdetaillayout) |
| 左侧是平铺列表（分类 / 文件 / 分组） | [左侧平铺列表（NavListPanel）](#左侧平铺列表navlistpanel) |
| 指标卡、图表分栏、卡片栅格、表单多列 | [统计卡片与自适应栅格](#统计卡片与自适应栅格) |
| 给操作列定 `width` | [操作列宽度估算](#操作列宽度估算) |
| 列表数据量 > 500 条 | [虚拟化表格](#虚拟化表格) |

---

## 页面级多 Tab 布局

```tsx
return (
  <div className="page-container page-tabs-page">
    <Tabs collapsible="auto" activeKey={activeTab} onChange={handleTabChange} type="line" lazyRender keepDOM={false}>
      <TabPane tab="列表" itemKey="list">
        <SearchToolbar>{/* 当前 tab 的筛选与操作按钮 */}</SearchToolbar>
        <ConfigurableTable bordered ... />
      </TabPane>
      <TabPane tab="统计分析" itemKey="stats">
        <StatsPanel />
      </TabPane>
    </Tabs>
  </div>
);
```

- 每个 `TabPane` 内承载该 tab 的完整内容：`SearchToolbar`、操作按钮、空状态、表格或统计面板
- tab 相关操作按钮（「全部标记为已读」「清理日志」）放在对应 `TabPane` 内的 `SearchToolbar`，
  不要放在 TabBar 右侧
- `page-tabs-page` 只用于页面最外层业务 Tabs；抽屉、弹窗、卡片内代码示例、左右分栏内部小 tabs 不使用
- 非激活 tab 的查询用 `enabled: activeTab === 'xxx'` 门控，切换时懒加载并缓存
- `collapsible="auto"` 是**所有** `Tabs` 的统一要求（不限页面级），见
  [constraints-frontend.md → 布局与响应式](./constraints-frontend.md#布局与响应式)：
  它把 TabBar 包进 `ResizeObserver`，按「是否折行 + `scrollWidth` 超出」判定溢出，
  仅在真放不下时折叠，空间恢复后自动退出，不占用固定空间

---

## 左右分栏（MasterDetailLayout）

适用于消息中心、智能对话、AI 侧边栏、数据库表浏览、日志文件等结构。
组件路径 `components/MasterDetailLayout.tsx`。

### 标准模式：页面直接作为 Outlet 根节点

页面从 `admin-content`（已分配确定高度的 flex 容器）继承高度，直接返回组件，无需外层 wrapper：

```tsx
<MasterDetailLayout
  defaultSize={260}        // 左栏默认宽度
  minSize={200}
  maxSize={480}
  persistKey="xxx-page"    // localStorage 持久化（宽度 + 左右位置）
  master={(
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部固定区域 */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--semi-color-border)', flexShrink: 0 }}>…</div>
      {/* 滚动列表区域 */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>…</div>
    </div>
  )}
  detail={<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>…</div>}
/>
```

桌面端默认允许调换 master 左右位置：master 使用 `MasterDetailLayout.Header` 或 `NavListPanel` 时，
切换按钮自动出现在操作区最右侧，业务页面不得重复渲染 `SideToggle`。
明确不允许调换时传 `sideSwitchable={false}`。

### 主侧在右（`side="right"`）

页面左侧为主内容区、右侧为可收起辅助面板（如 AI 侧边栏）时：宽内容放 `detail`，
窄面板放 `master`，并设 `side="right"`。

```tsx
<MasterDetailLayout
  side="right"
  defaultSize={380} minSize={300} maxSize={600}
  collapsed={!panelVisible}
  persistKey="xxx-sidebar"
  detail={<MainContent />}    // 宽的主体内容（左侧）
  master={<SidePanel />}      // 窄的辅助面板（右侧，可调整宽度）
/>
```

### 嵌套在 Semi Tabs 内

`semi-tabs-pane-motion-overlay` 会打断高度继承链，**高度链四条缺一不可**：

1. 页面根 div：`height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden'`
2. `<Tabs>`：`className="tabs-fill-height"`（已在 `global.css` 定义）+
   `style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}` +
   `contentStyle={{ flex: 1, minHeight: 0, overflow: 'hidden' }}`
3. 需要全高的 `<TabPane>`：`style={{ height: '100%' }}`
4. TabPane 内层 wrapper div：`style={{ height: '100%' }}`

```tsx
<div style={{ height: '100%', boxSizing: 'border-box', padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
  <Tabs
    collapsible="auto"
    className="tabs-fill-height"
    style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    contentStyle={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
    tabBarStyle={{ marginBottom: 8 }}
  >
    <TabPane tab="列表" itemKey="list" style={{ height: '100%' }}>
      <div style={{ height: '100%' }}>
        <MasterDetailLayout persistKey="xxx-list" master={…} detail={…} />
      </div>
    </TabPane>
    {/* 无高度限制需求的 tab 不需要 style={{ height: '100%' }} */}
  </Tabs>
</div>
```

### 窄屏单栏（响应式）

容器宽度小于 `responsiveBreakpoint`（默认 720）时自动切换为单栏，一次只渲染一侧。
**该断点比较的是容器宽度而非视口宽度**——后台内容区还要扣除侧边栏，勿按视口断点估算。

**A 类「列表 → 详情」**：master 是列表（根视图），窄屏先显示 master，选中后进入 detail，
返回条由组件渲染在 detail 侧。

```tsx
<MasterDetailLayout
  showDetail={selected !== null}
  onBack={() => setSelected(null)}
  master={<List onSelect={setSelected} />}
  detail={<Detail record={selected} />}
/>
```

**B 类「筛选树 + 主体内容」**：master 是分类 / 部门筛选器，detail 才是页面主体（表格）。
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
并在切回双栏时补选；用 ref 而非 state 保存布局形态，使自动选中的 effect 只依赖数据：

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

### 常见陷阱

- master 内需要「头部 + 滚动列表」时必须用 flex column 容器包裹：搜索头 `flexShrink: 0`，
  列表 `flex: 1` + `overflow: auto` + `minHeight: 0`
- **不要把 master 的 div 写成 Fragment（`<>`）**：Fragment 无法接受 `height: '100%'`，列表将无高度约束
- Tabs 嵌套时漏加 `className="tabs-fill-height"`：动画层破坏高度链，列表撑满后无滚动
- `gap` 默认为 0：不需要间距且无边框时保持默认
- B 类页面漏传 `onMasterBack`：窄屏切到 master 后无返回入口，用户只能靠浏览器后退

---

## 左侧平铺列表（NavListPanel）

左侧 master 是**平铺列表**（分类 / 文件 / 分组，非树形）时使用 `NavListPanel<T>` + `NavListItem`
（`components/NavListPanel.tsx`）。底层由 Semi `List` / `List.Item` 实现。
树形数据（需展开 / 折叠节点）改用 Semi `Tree`，例如用户管理的部门树。

- `NavListPanel<T>` 核心 props：`title`、`headerExtra`、`search`（搜索框配置）、`loading`、
  `emptyText`、`footer`（分页等）
- **dataSource 模式（默认）**：`<NavListPanel dataSource={items} renderItem={(item) => <NavListItem key={item.id} … />} />`，
  空数组时自动显示 `emptyText`
- **children 模式**：`<NavListPanel>{items.map(fn)}</NavListPanel>`，空数组不触发 emptyContent
  （需 `childCount > 0` 判断）；`rawBody` 场景必须走此路径
- **分组 / Collapse 场景**（如 DbAdmin）：传 `rawBody bodyNoPadding`，在 `children` 内自行渲染
  Collapse + 内嵌 `<List split={false} className="nav-list-panel__list">`
- `NavListItem` props：`active`、`onClick`、`icon`（左侧图标或彩色圆点）、`primary`、`secondary`、
  `meta`（底部元信息）、`extra`（hover 显示的操作区，`extraAlwaysVisible` 让其常驻）
- extra 含多个操作时用 `Dropdown`（`trigger="click"` + `clickToHide`）+ `MoreHorizontal` 按钮包裹
- meta 区域**禁止**使用 `<Tag color="...">` 内联标签（会渲染颜色指示器色块），改用 styled span

---

## 统计卡片与自适应栅格

### StatCard / StatGrid

```tsx
// 无图表的页面直接引具体文件，避免桶文件带入约 2MB 的 vchart
import { StatCard, StatGrid } from '@/components/charts/StatCard';
// 页面本来就有图表时可从桶文件一起引：
// import { LineChart, chartOptions, StatCard, StatGrid } from '@/components/charts';

<StatGrid minItemWidth={180}>
  <StatCard title="今日 PV" value={stats.pv} icon={<Eye size={19} />} accent="#3b82f6" />
  {/* 环比：absolute 展示差值，ratio 按比率渲染成百分比（0.12 → +12.0%） */}
  <StatCard title="今日 UV" value={stats.uv} delta={stats.uvDelta} deltaFormat="absolute" />
  {/* 可点击筛选卡：渲染为 button，自动带 aria-pressed 与选中边框 */}
  <StatCard
    title="审批中" value={stats.running}
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

`.chart-grid` 的两列锁定走**视口**断点。若栅格位于抽屉、弹窗或分栏面板等**比视口窄得多的容器**内，
改用 `StatGrid`（纯容器自适应，不看视口）。

### 通用自适应栅格（`.auto-grid`，`global.css`）

固定列数的卡片栅格、表单多列、选择器画廊用它。轨道下限取「内容最小宽」与「N 等分宽」的较大者：
宽屏由 N 等分宽占优，恰好 N 列；窄屏由 `--auto-grid-min` 接管，自动降列。

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

### 抽屉 / 弹窗宽度

窄屏适配已由 `global.css` 全局兜底，页面**无需**再写 `width={isMobile ? '100%' : 720}`：

| 断点 | 规则 |
| --- | --- |
| `--sm-down` | `.semi-modal` → `width/max-width: 95vw` |
| `--lg-down` | `.semi-sidesheet-inner` → `max-width: 95vw` |
| `--xs-down` | `.semi-sidesheet-inner` → `width: 100vw` |

固定 `width={860}` 的 SideSheet 在 390px 下同样满宽，加 `isMobile` 判断是无效代码。

---

## 操作列宽度估算

`createOperationColumn` 的 `width` 是手写数值，与按钮内容无任何关联——加了动作却没同步宽度时
**不会报错**。单元格没有 `overflow: hidden`，所以症状不是按钮消失，而是先吃掉两侧 padding、
再挤压相邻的 `fixed: 'right'` 列，很难在开发时被注意到。因此新增或调整动作后必须按下式复核。

### 度量常量

均取自 `semi.min.css` 与 `ResponsiveTableActions` 实现，不是经验值：

| 项 | 值 | 来源 |
| --- | --- | --- |
| 文字按钮左右 padding | 12 + 12 = 24 | `.semi-button-size-small` |
| 按钮字号 | 14px / 600 | 同上 |
| 「更多」图标按钮 | 4 + 14 + 4 = 22 | `.semi-button-with-icon-only.semi-button-size-small` |
| 按钮间距 | 4 | `<Space spacing={4}>` |
| 单元格左右 padding | 16 + 16 = 32 | `.semi-table-row-cell` |

文字宽度：**汉字 14px/字**（全角即 1em），ASCII 约 7.8px/字。

### 计算方式

```text
按钮宽 = 24 + 文字宽              // 2 字 52、3 字 66、4 字 80、5 字 94
内容宽 = Σ 按钮宽 + 4 × (按钮数 - 1)
        （有动作未列入 desktopInlineKeys 时，再加一个 22 的「更多」按钮）
列宽   = 内容宽 + 32，向上取整到 10
```

判定口径：

| 关系 | 结论 |
| --- | --- |
| 列宽 < 内容宽 | **必然溢出**，禁止 |
| 内容宽 ≤ 列宽 < 内容宽 + 16 | 偏挤，两侧几乎无留白，应避免 |
| 列宽 ≥ 内容宽 + 32 | 推荐 |

### 关键：内容宽要按**能同时出现**的动作算

绝大多数动作带 `hidden` 或写成 `...(cond ? [{...}] : [])`，按动作总数计算会严重高估：

- 权限条件（`hasPermission(...)`）**要按全部为真**计算——超管会同时拿到所有动作
- 状态条件（`status === 'draft'` 与 `status !== 'draft'`）互斥，取各分支的**最大值**，不要相加

### 动作过多时不要一味加宽

估算结果超过约 280px 时，加宽会挤占业务列。改为用 `desktopInlineKeys` 只保留 1–2 个高频动作内联，
其余进「更多」菜单（危险动作移入后仍是红色，`renderActionMenu` 已映射 `danger`）。

### 常用组合参考

| 动作 | 内容宽 | 列宽 |
| --- | --- | --- |
| 详情 | 52 | 90 |
| 编辑 / 删除 | 108 | **130**（全项目统一值） |
| 编辑 / 删除 + 更多 | 134 | 170 |
| 三个 2 字动作 | 164 | 200 |
| 四个 2 字动作 | 220 | 260 |
| 四个 2 字动作 + 更多 | 246 | 280 |

---

## 虚拟化表格

列表数据量较大（通常 > 500 条，如地区省市县、日志）时为 `ConfigurableTable` 开启 `virtualized`。
`scroll.y` 是虚拟化生效的**必要条件**。

### 弹性全宽方案（推荐）

让**一列不设 `width`**（通常是名称 / 标题主列），表格自动填满容器。
`fixed: 'right'` 仅保留操作列，状态列等去掉 `fixed`。

```tsx
const columns: ColumnProps<Region>[] = [
  { title: '地区名称', dataIndex: 'name' },              // 不设 width — 弹性列
  { title: '区划代码', dataIndex: 'code', width: 140 },
  { title: '级别',    dataIndex: 'level', width: 90 },
  // 不加 fixed: 'right'，否则必须设 scroll.x 导致宽度固定
  { title: '状态',    dataIndex: 'status', width: 90 },
  createOperationColumn<Region>({ width: 160, actions: (record) => [ … ] }),
];

<ConfigurableTable
  bordered
  virtualized
  scroll={{ y: 'calc(100vh - 260px)' }}   // 只设 y，不设 x（260px ≈ 顶栏 + 工具栏 + 内边距）
  columns={columns}
  dataSource={list}
  rowKey="id"
  pagination={false}
  onRefresh={() => void treeQuery.refetch()}
  refreshLoading={treeQuery.isFetching}
/>
```

### 固定宽度方案

所有列都有显式 `width` 时（含 `fixed: 'right'` 的状态列），必须设 `scroll.x` = 各列宽度之和，
否则表头与数据行错位；代价是宽屏下表格不填满容器。

```tsx
<ConfigurableTable virtualized scroll={{ x: 1050, y: 'calc(100vh - 260px)' }} columns={columns} />
```

数据量小（< 200 条）且有复杂自定义渲染器的树形表格（如部门管理）**不建议**开启 `virtualized`；
菜单管理（880+ 节点）、地区管理等大数据量树形表格已开启。开启后受控 `expandedRowKeys` 仍正常工作。
