# 公共组件指南

本页列出 `packages/web/src/components/` 中的公共组件，说明其用途与使用方式。所有新页面应优先使用这些组件，保持全站交互一致性。

---

## ConfigurableTable

所有 CRUD 列表页面的标准数据表格组件，在 Semi Design `Table` 基础上封装了**列显隐配置**功能。

### ConfigurableTable 功能特点

- 右上角内置「列设置」下拉菜单，用户可勾选/取消勾选各列的显示状态
- 列显隐配置自动持久化到 `localStorage`（key 默认根据页面路径 + 列 key 自动生成）
- 通过 `createOperationColumn` 创建的操作列默认不可隐藏，并会在移动端自动收窄
- 可选展示刷新按钮，并内置表格尺寸、边框/斑马纹显示设置和全屏展示按钮
- 分页配置会自动补充 `showTotal`、`showSizeChanger` 和 `[10, 20, 50, 100]` 页大小选项
- 完全透传 Semi Design `TableProps`，使用方式与 `<Table>` 一致

### ConfigurableTable 扩展 Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `columnSettings` | `boolean` | `true` | 是否显示列设置按钮 |
| `columnSettingsKey` | `string` | 自动生成 | 自定义 localStorage 存储 key |
| `columnSettingsLabel` | `string` | `'列设置'` | 列设置按钮文字 |
| `onRefresh` | `() => void` | — | 传入后显示右上角刷新按钮 |
| `refreshLoading` | `boolean` | `false` | 刷新按钮 loading 状态 |

### ConfigurableTable 使用示例

```tsx
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';

const columns = [
  { title: '名称', dataIndex: 'name' },
  createOperationColumn<User>({
    width: 160,
    desktopInlineKeys: ['edit', 'delete'],
    actions: (record) => [
      { key: 'edit', label: '编辑', onClick: () => openEdit(record) },
      { key: 'delete', label: '删除', danger: true, onClick: () => handleDelete(record.id) },
    ],
  }),
];

// 标准分页列表（配合 TanStack Query 域 hooks 与 useListSearch，见数据获取文档）
<ConfigurableTable
  bordered
  columns={columns}
  dataSource={listQuery.data?.list ?? []}
  loading={listQuery.isFetching}
  onRefresh={() => void listQuery.refetch()}
  refreshLoading={listQuery.isFetching}
  rowKey="id"
  size="small"
  empty="暂无数据"
  pagination={buildPagination(listQuery.data?.total ?? 0)}
/>

// 虚拟化大数据量列表
<ConfigurableTable
  bordered
  virtualized
  scroll={{ y: 'calc(100vh - 260px)' }}
  columns={columns}
  dataSource={data}
  rowKey="id"
  pagination={false}
/>
```

### ConfigurableTable 注意事项

- `createOperationColumn` 默认在桌面端内联展示全部动作；动作较多时可通过 `desktopInlineKeys` 指定高频内联按钮，其余动作进入更多菜单；移动端始终只显示更多按钮
- 若需关闭列设置功能（如只有 1-2 列的简单表格），传 `columnSettings={false}`

> 列表页必须用 `ConfigurableTable`（带 `bordered`）而非裸 `Table`、操作列必须经 `createOperationColumn` 创建、
> 必须传 `onRefresh` / `refreshLoading` —— 这些硬性约束见
> [`constraints.md` → 前端层](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)。

---

## SearchToolbar

搜索工具栏组件，用于所有 CRUD 列表页面的顶部筛选区域。

### SearchToolbar Props

- `children?: ReactNode`：简单工具栏内容，自动用 `<Space wrap>` 包裹
- `className?: string`：附加 CSS 类名，应用到外层容器
- `primary?: ReactNode`：结构化模式下的桌面端主搜索区
- `filters?: ReactNode`：结构化模式下的桌面端筛选区
- `actions?: ReactNode`：结构化模式下的桌面端操作区
- `mobilePrimary?: ReactNode`：移动端默认露出的核心区域；不传时使用 `primary`
- `mobileFilters?: ReactNode`：移动端底部筛选抽屉内容；不传时使用 `filters`
- `mobileActions?: ReactNode`：移动端更多菜单内容；不传时使用 `actions`
- `filterTitle?: ReactNode`：移动端筛选抽屉标题，默认 `筛选条件`
- `actionTitle?: string`：移动端更多菜单标题，默认 `更多操作`
- `onFilterApply?: () => void`：移动端筛选抽屉底部 `查询` 按钮回调
- `onFilterReset?: () => void`：移动端筛选抽屉底部 `重置` 按钮回调

### SearchToolbar 使用示例

简单页面继续使用 children 写法：

```tsx
import { SearchToolbar } from '../../components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { Select } from '@douyinfe/semi-ui';

<SearchToolbar>
  <KeywordInput placeholder="请输入名称" value={keyword} onChange={setKeyword} width={200} />
  <Select
    placeholder="请选择状态"
    value={status}
    onChange={(v) => setStatus(v as string)}
    allowClear
    style={{ width: 120 }}
  >
    <Select.Option value="enabled">启用</Select.Option>
    <Select.Option value="disabled">禁用</Select.Option>
  </Select>
  <SearchButton onClick={handleSearch} />
  <ResetButton onClick={handleReset} />
  <CreateButton onClick={openCreate} />
</SearchToolbar>
```

筛选项或操作按钮较多时使用结构化写法，让移动端只露出高频入口：

```tsx
<SearchToolbar
  primary={(
    <>
      <KeywordInput placeholder="请输入名称" value={keyword} onChange={setKeyword} onSearch={handleSearch} />
      <Select
        placeholder="请选择状态"
        value={status}
        onChange={(v) => setStatus(v as string)}
        showClear
        style={{ width: 120 }}
      />
      <SearchButton onClick={handleSearch} />
      <ResetButton onClick={handleReset} />
    </>
  )}
  actions={(
    <>
      <Button type="primary" icon={<Download size={14} />} onClick={handleExport}>导出</Button>
      <CreateButton onClick={openCreate} />
    </>
  )}
  mobilePrimary={(
    <>
      <KeywordInput placeholder="请输入名称" value={keyword} onChange={setKeyword} onSearch={handleSearch} />
      <SearchButton onClick={handleSearch} />
      <CreateButton onClick={openCreate} />
    </>
  )}
  mobileFilters={(
    <Select
      placeholder="请选择状态"
      value={status}
      onChange={(v) => setStatus(v as string)}
      showClear
      style={{ width: 120 }}
    />
  )}
  mobileActions={(
    <Button icon={<Download size={14} />} onClick={handleExport}>导出</Button>
  )}
  filterTitle="筛选条件"
  onFilterApply={handleSearch}
  onFilterReset={handleReset}
/>
```

### SearchToolbar 注意事项

- 简单工具栏使用 `children` 即可；筛选项/操作按钮较多时优先使用结构化 props
- 移动端不要把页面导航、筛选项和顶部常用功能混在一起：筛选属于当前列表页，应放进底部筛选抽屉

> 移动端露出哪些入口、按钮文案与 `type` 怎么定，属于硬性约束，见
> [`constraints.md` → 搜索栏布局](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)。

---

## toolbar-controls（查询 / 重置 / 新增 / 刷新按钮）

`@/components/toolbar-controls` 提供列表页搜索工具栏的四个标准按钮，统一 `type`、图标与图标尺寸——改一次视觉只需改组件本身。

| 组件 | 视觉 | 默认文案 |
| --- | --- | --- |
| `SearchButton` | `type="primary"` + `Search` 图标 | 查询 |
| `ResetButton` | `type="tertiary"` + `RotateCcw` 图标 | 重置 |
| `CreateButton` | `type="primary"` + `Plus` 图标 | 新增 |
| `RefreshButton` | 同 `ResetButton` | 刷新 |

四者 props 一致：`onClick` / `disabled` / `loading` / `children`。

```tsx
import { CreateButton, RefreshButton, ResetButton, SearchButton } from '@/components/toolbar-controls';

// 默认文案：写自闭合
<SearchButton onClick={handleSearch} />
<ResetButton onClick={handleReset} />

// 文案不同：用 children 覆盖，视觉保持一致
<CreateButton onClick={openCreate}>新增规则</CreateButton>
<RefreshButton onClick={() => void refetch()} loading={isFetching} />
```

`RefreshButton` 与 `ResetButton` 视觉相同但语义不同（重新拉数据 vs 清空筛选条件），拆成两个组件是为了避免
将来只想调整其中一个时被同一次改动误伤。

> 哪些按钮必须用这四个组件、哪两类情况应保持原生 `Button`，见
> [`constraints.md` → 搜索栏公共按钮](https://github.com/iwangbowen/zenith-admin/blob/master/.agents/skills/zenith/references/constraints.md)。

---

## search-filters（关键字 / 状态 / 时间范围筛选）

`@/components/search-filters` 提供列表页搜索工具栏的三个标准筛选控件，与 `toolbar-controls`
配套——那边收敛动作按钮，这边收敛筛选输入（放大镜前缀、`showClear`、固定宽度等装饰性属性）。

| 组件 | 内置默认 | 覆盖方式 |
| --- | --- | --- |
| `KeywordInput` | 放大镜前缀、`showClear`、宽度 220、回车触发 `onSearch` | `width` / `style` / 其余 props 原样穿透 |
| `StatusSelect` | 占位「全部状态」、`showClear`、宽度 120；`items` 传字典项（通常来自 `useDictItems('common_status').items`） | `placeholder` / `width` |
| `DateRangeFilter` | `dateTimeRange`、占位「开始时间 / 结束时间」、宽度 360 | `type="dateRange"`（宽度自动取 260）/ `placeholder` / `width` |

```tsx
import { DateRangeFilter, KeywordInput, StatusSelect } from '@/components/search-filters';

<KeywordInput placeholder="搜索名称/编码" value={draftParams.keyword}
  onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} />

<StatusSelect items={statusItems} value={draftParams.status}
  onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))} />

<DateRangeFilter value={draftParams.timeRange}
  onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))} />
```

三者只收敛装饰性属性，业务属性（`value` / `onChange` / `placeholder`）仍显式传入——否则组件会退化成
难以定制的黑盒，页面会绕开它退回手写。另外两点便利：

- `StatusSelect` 清空时回调空串而非 `undefined`，与 `draftParams` 里状态字段的类型对齐
- `DateRangeFilter` 把 Semi 宽松的 `onChange` 值收窄为 `[Date, Date] | null`，页面不必再写
  `Array.isArray(v) && v.length >= 2` 之类的判断

> **例外**：面板/弹窗内需要跟随容器自适应的搜索框（如 `NavListPanel` 的 List header）不套用这些控件——
> 它们带固定默认宽度，会改变布局。

### KeywordSearchToolbar（一体化关键字工具栏）

仅有「关键字输入 + 查询 + 重置（+ 可选操作按钮）」的列表页可直接用 `@/components/KeywordSearchToolbar`：
内部组合 `SearchToolbar` 结构化模式与上述控件，桌面端平铺展示，移动端露出输入框与查询按钮、重置与附加操作收进更多菜单。

```tsx
<KeywordSearchToolbar
  placeholder="搜索名称/编码"
  value={draftParams.keyword}
  onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
  onSearch={handleSearch}
  onReset={handleReset}
  actions={<CreateButton onClick={openCreate} />}
/>
```

---

## RegionSelect

省市区三级联动选择组件，基于 Semi Design Cascader 封装，数据来源为后端行政区划接口。

### RegionSelect 功能特点

- 支持省 → 市 → 区/县三级行政区划
- 数据通过 TanStack Query 的 `useRegionLookupTree()`（`hooks/queries/regions.ts`，`GET /api/regions`）加载，全局共享缓存（`staleTime` 5 分钟），多个实例只请求一次
- 只展示 `status === 'enabled'` 的地区节点
- 返回所选区划的完整 code 路径（如 `['110000', '110100', '110101']`）
- 内置搜索过滤（`filterTreeNode`）；加载中自动禁用并显示"加载中..."占位

### RegionSelect Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string[]` | — | 当前选中的区划代码路径 |
| `onChange` | `(value: string[] \| undefined) => void` | — | 选中变化回调，清空时传 `undefined` |
| `placeholder` | `string` | `'请选择省/市/区'` | 占位文字（加载中自动替换为"加载中..."） |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `showClear` | `boolean` | `true` | 是否显示清空按钮 |
| `changeOnSelect` | `boolean` | `true` | `true`：可选中任意层级（省/市/区均可）；`false`：必须选到最底层（区/县） |
| `style` | `CSSProperties` | — | 行内样式 |
| `className` | `string` | — | 附加 CSS 类名 |

### RegionSelect 使用示例

基础用法（可选到任意层级）：

```tsx
import RegionSelect from '@/components/RegionSelect';
import { useState } from 'react';

const [regionCodes, setRegionCodes] = useState<string[]>();

<RegionSelect
  value={regionCodes}
  onChange={setRegionCodes}
  style={{ width: 320 }}
/>
```

必须选到县级（`changeOnSelect={false}`）：

```tsx
<RegionSelect
  value={regionCodes}
  onChange={setRegionCodes}
  changeOnSelect={false}
  placeholder="请选择到县/区级"
  style={{ width: 320 }}
/>
```

禁用状态：

```tsx
<RegionSelect disabled placeholder="禁用" style={{ width: 320 }} />
```

此组件已在用户管理的「省市区」字段使用，也可在任何需要行政区划选择的表单中复用。

---

## 富文本编辑器（wangEditor）

**使用场景**：用于通知公告内容编辑和工作流表单富文本字段。

公共组件 `RichTextEditor` 使用 [wangEditor](https://www.wangeditor.com/) 作为富文本编辑器，支持：

- 文字格式化（粗体、颜色、字号等）
- 图片上传（通过 `POST /api/files/upload` 上传，自动插入编辑器）
- 编辑器上传请求携带 `Authorization: Bearer <token>` 头

**图片上传集成**：编辑器配置了自定义上传函数，上传成功后将返回的 URL 插入到编辑器内容中。相关配置在 `RichTextEditor` 组件内部实现。

---

## DictTag

根据字典编码和字典项值，自动渲染带颜色的 Semi Design `Tag`。颜色来源于字典项的 `color` 字段，内部使用 `useDictItems` hook 拉取字典数据（基于 TanStack Query，同一 `dictCode` 全局共享缓存、自动去重并发请求）。

### DictTag Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `dictCode` | `string` | — | 字典编码，如 `'common_status'` |
| `value` | `string \| undefined \| null` | — | 字典项的值，`null`/空串时渲染 `—` |
| `fallback` | `string` | — | 找不到字典项时的兜底文本，默认显示原始 `value` |
| `size` | `TagProps['size']` | `'small'` | Tag 尺寸，继承 Semi Design TagProps |
| 其他 TagProps | — | — | 透传给底层 `<Tag>`（除 `color` 和 `children`） |

### DictTag 使用示例

```tsx
import DictTag from '@/components/DictTag';

// 渲染状态 Tag（字典编码 common_status）
<DictTag dictCode="common_status" value={record.status} />

// 渲染性别 Tag，找不到时显示"未知"
<DictTag dictCode="user_gender" value={record.gender} fallback="未知" />
```

### 配合 `useDictItems` 使用

如果页面需要字典数据做下拉选项，可直接使用 `useDictItems` hook：

```tsx
import { useDictItems } from '@/hooks/useDictItems';

const { items, loading, getLabel, getColor } = useDictItems('common_status');

// items: DictItem[]，每项包含 { value, label, color, ... }
// getLabel('enabled') => '启用'；getColor('enabled') => 字典项颜色
```

---

## 其他通用基础组件

| 组件 | 用途 |
| --- | --- |
| `AppModal` | 带全屏/还原按钮的 Semi `Modal` 封装，表单弹窗和文件预览弹窗复用 |
| `AppLogo` | 应用 Logo，支持不同尺寸和样式 |
| `AnnouncementDetailModal` | 公告详情弹窗，支持加载态和上一条/下一条导航 |
| `ApprovalTimeline` | 审批流时间线，展示发起、审批任务和流程结束节点 |
| `AsyncTaskProgress` | 异步任务进度单元格：确定进度显示进度条，不定进度显示 Spin + 说明 |
| `AvatarCropperModal` | 头像裁剪弹窗（圆形裁剪框 + 旋转） |
| `PresetAvatarPickerModal` | 预设头像选择弹窗，个人中心与用户管理共用 |
| `ColorPickerInput` | Semi `ColorPicker` 表单封装，值统一为颜色字符串 |
| `CronBuilderModal` | 6 字段 Cron 表达式可视化编辑弹窗 |
| `CronBuilderPopover` | Cron 快速选择 Popover |
| `ExportButton` | 列表导出按钮，接入导出任务（`useExportJobRunner`），默认脱敏导出 |
| `FileNameCell` | 表格「文件名」单元格：类型图标 + 列宽内省略 + Tooltip 完整名称 |
| `IconPicker` | lucide 图标选择器，用于菜单图标等配置 |
| `ImageUploadField` | 单图上传字段：预览缩略图 + 悬浮删除按钮 |
| `MonthCalendar` | 月视图日历（Semi `Calendar` 封装，内置月份切换头部） |
| `PasswordStrengthMeter` | 密码强度与策略达标提示 |
| `SignaturePad` | Canvas 手写签名板，输出 PNG data URL |
| `UserAvatar` | 用户头像展示，缺省头像按名称生成稳定色块 |
| `UserPreviewCell` | 表格「成员/用户」列单元格：头像组 + 数量 Tag，部门/角色/岗位/用户组列表共用；传入 `scope` 后可点击弹出成员名单（支持搜索与分页） |
| `Watermark` | 页面水印覆盖层 |

## 业务选择与权限组件

| 组件 | 用途 |
| --- | --- |
| `DepartmentSelect` | 启用部门树选择，支持单选/多选 |
| `DictSelect` | 按 `dictCode` 拉取字典项，支持单选/多选 |
| `UserSelect` | 全量用户下拉选择，支持单选/多选 |
| `UserTransferSelect` | 用户穿梭选择器，支持按部门组织展示 |
| `MemberSelect` | 会员远程搜索下拉（昵称/手机号/用户名），积分调整、发券等场景使用 |
| `MediaPickerModal` | 媒体库选择器：从文件中心挑选已有文件，支持搜索与就地上传 |
| `permissions/MenuPermissionPanel` | 菜单权限树面板，角色和用户授权场景复用 |
| `permissions/DataScopePanel` | 数据权限范围面板，角色和用户数据权限场景复用 |

## 布局、导航与状态组件

| 组件 | 用途 |
| --- | --- |
| `MasterDetailLayout` | 主从分栏布局，支持拖拽宽度和本地持久化 |
| `NavListPanel` | 带标题、搜索、加载、空状态和底部插槽的列表面板 |
| `BreadcrumbMenuPopover` | 面包屑中的菜单 Popover，支持目录层级跳转 |
| `MenuSearchInput` | 菜单搜索入口，配合全局快捷键使用 |
| `MenuCommandPalette` | 菜单命令面板，支持搜索和快速跳转 |
| `NProgress` | 顶部路由切换进度条 |
| `PageErrorBoundary` | 页面级错误边界（chunk 加载失败时提示并整页刷新）及路由感知版 `RouteErrorBoundary` |
| `FullPageRetry` | 全屏失败重试页（会话校验、导航菜单等首载失败）：按离线/连接失败/服务端异常/维护中区分文案，离线感知 + 指数退避自动重试，并提供次要出口 |
| `LockScreen` | 后台锁屏界面，支持密码校验后解锁 |
| `ForceChangePasswordModal` | 强制修改密码弹窗 |
| `MaintenanceOverlay` | 维护模式覆盖层 |
| `TaskTray` | 顶栏全局任务托盘：进行中/最近完成的异步任务 |
| `FeedbackWidget` | 全局意见反馈弹层（入口在头像下拉，由系统配置控制显隐） |
| `QuickChatButton` | 快捷聊天悬浮入口 |
| `ElectronTitleBar` | Electron 环境自定义标题栏 |
| `ThemedReactFlow` | 跟随应用主题的 React Flow 画布封装 |

## 文件与预览组件

| 组件 | 用途 |
| --- | --- |
| `FileAttachment` | 附件上传/展示组件 |
| `FilePreviewModal` | 全站统一文件预览弹窗（详见[文件预览组件](/frontend/file-preview)） |
| `FilePreviewLayer` + `useFilePreview` | 图集预览 + 文件预览的组合弹层与配套 hook（列表页推荐接入方式） |
| `PDFPreviewPanel` | PDF 预览面板（`@embedpdf/react-pdf-viewer`） |
| `FileViewerPreviewPanel` | File Viewer 驱动的 Office、OFD、压缩包、邮件、XMind 与 Mermaid 只读预览 |
| `JsonPreviewPanel` | JSON 只读预览 |
| `MarkdownPreviewPanel` | Markdown 只读预览 |
| `MonacoPreviewPanel` | 代码和纯文本只读预览 |

## 日志、报表与工作流组件

| 组件 | 用途 |
| --- | --- |
| `logs/LoginLogsTable` | 登录日志表格 |
| `logs/OperationLogsTable` | 操作日志表格 |
| `logs/ClearLogsControl` | 日志清理入口（按时间范围清理） |
| `ReportEmbed` | 报表看板嵌入组件（支持受控筛选值） |
| `ReportParamDialog` | 报表参数填写对话框 |
| `workflow/SavedViewsBar` | 列表筛选条件保存视图条 |
| `workflow/BusinessFormHost` | 工作流自定义业务表单宿主（按 `component` 路径挂载 pages 下的组件） |
| `workflow/WorkflowApprovalChainPanel` | 发起态审批链路预览面板（含自选审批人） |
| `workflow/WorkflowGraphView` | 流程图只读预览 |
| `workflow/WorkflowInstanceDetailPanel` | 流程实例详情面板 |
| `workflow/WorkflowInstanceDetailSheet` | 流程实例详情抽屉 |
| `workflow/WorkflowNodeListView` | 流程节点线性列表 |
| `workflow/WorkflowLaunchForm` | 流程发起表单（表单运行时渲染） |

## 组件子目录库

除单文件组件外，`components/` 下还有两个成套的子目录库：

- **`charts/`**：VChart 图表构建工具集（`builders` 系列图表 spec 构建器、`EmptyChart` 空态、统一调色板），仪表盘与报表页共用
- **`data-grid/`**：db-admin 数据浏览用的虚拟滚动可编辑表格 `DataGrid`（单元格编辑、剪贴板、本地排序、xlsx 导出等）
