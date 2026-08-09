# 行为分析

行为分析页面（`/analytics/behavior`，权限 `analytics:view`）提供 13 个 Tab：**概览 / 实时 / 事件分析 / A/B 实验 / 页面停留 / 功能使用 / 会话 / 漏斗 / 留存 / 路径 / 用户分析 / 维度分布 / 点击分布**，以折线、面积、柱状、饼图、热力矩阵等图表呈现。多数统计接口支持 `days`（1–365）/ `limit` 查询，页面提供近 7 / 30 / 90 天切换；会话列表支持用户名与设备筛选，维度分布支持浏览器、操作系统、设备、地域、来源、引荐与页面维度。

## 概览

`GET /api/analytics/overview` —— 核心 KPI 卡片，支持 `days=N` 或自定义日期范围（`startDate` / `endDate`，`YYYY-MM-DD`），含环比：

- 浏览量 PV、访客数 UV、会话数、事件数、新增用户
- 平均会话时长、跳出率、人均页数
- 实时在线（近 5 分钟活跃访客）
- PV / UV / 会话 / 跳出率的环比涨跌（▲/▼）

下方 `GET /api/analytics/trends` 渲染 PV/UV/会话/事件的多折线趋势图，同样支持自定义日期范围；传 `compare=true` 时额外返回上一等长周期的对比序列，用于同图环比叠加。

## 实时

`GET /api/analytics/realtime`（每 10 秒轮询，并订阅 WebSocket `analytics:ingest` 广播即时刷新）：

- 实时在线、近 30 分钟浏览、近 1 分钟事件
- 近 30 分钟逐分钟事件面积图
- 当前热门页面、最近事件流

## 页面停留

`GET /api/analytics/page-stats` —— 各页面访问次数、平均停留、中位数、P90（基于 `page_leave` 的 `durationMs` 百分位）。

## 功能使用

`GET /api/analytics/feature-stats` —— 功能点击排行（`elementKey` / `elementLabel` / 区域 / 所在页面 / 使用次数），支持 `pagePath` 筛选。数据来自 autocapture + 手动 `trackFeature`。

## 会话分析

`GET /api/analytics/sessions` —— 会话列表：用户、入口/出口页、页数、事件数、时长、设备/浏览器/系统、地域、是否跳出。支持按用户名、设备类型筛选。

点击某条会话可查看**会话事件时间轴**：`GET /api/analytics/session-timeline?sessionId=X&limit=N`（默认 300 条，最多 1000）按时间顺序返回该会话内全部事件，用于单次访问的行为回溯。

## 漏斗分析

`POST /api/analytics/funnel` —— 自定义多步（2–10 步）**有序**转化漏斗。每步可按 `eventType` / `eventName` / `pagePath` / `elementKey` 定义，并可附加最多 5 条属性过滤（`properties: [{ key, op, value }]`，`op` 支持 `eq|neq|gt|gte|lt|lte|in`）。返回各步用户数、整体转化率、步间转化率、流失数与每步平均转化耗时（`averageConversionMs`，首步为 `null`）。

**转化窗口与顺序语义**：漏斗按用户单调时间线严格计算——第 1 步取每用户最早触发时间作为起点；第 N 步只统计「发生时间 ≥ 上一步命中时间，且 ≤ 首步时间 + `conversionWindowHours`」范围内该用户下一次命中（同一时刻允许）。避免把后续步骤早于前置步骤的行为误计为转化。

- `days`：分析窗口天数，1–365，默认 30。
- `conversionWindowHours`：转化窗口小时数，1–720，默认 72。
- `segmentId`：可选，限定分群成员参与统计（仅作用于漏斗起点，即第 1 步的候选用户集合）。

```jsonc
// 请求体示例
{ "days": 30, "conversionWindowHours": 72, "segmentId": null, "steps": [
  { "label": "进入首页", "pagePath": "/" },
  { "label": "浏览列表", "eventName": "$pageview" },
  { "label": "提交订单", "eventName": "order_submit",
    "properties": [{ "key": "amount", "op": "gte", "value": 100 }] }
] }
```

**保存报表**：配置好的漏斗可保存复用——`GET /api/analytics/reports?type=funnel` 列表、`POST /api/analytics/reports` 保存、`DELETE /api/analytics/reports/{id}` 删除（均 `analytics:view` 权限，按创建人隔离，落 `analytics_saved_reports` 表）。

## 留存分析

`GET /api/analytics/retention?days=N&mode=first_seen|window_first` —— cohort 留存矩阵（`days` 1–60，默认 14；展示 Day0…最多 Day7），前端以热力矩阵呈现，行=同期群、列=第 N 日，单元格颜色深浅表示留存率。

支持两种同期群口径（`mode`，默认 `first_seen`）：

| 口径 | 说明 |
|------|------|
| `first_seen`（默认，真实首访） | 在**租户全部历史数据**中计算每个 `distinctId` 的真正首次出现日期，仅保留首次出现日落在当前分析窗口（`days`）内的用户作为同期群；日期过滤不会提前作用于「首次出现」这一判定本身，避免把老用户误判为新用户 |
| `window_first` | 以当前查询窗口内的「窗口内首现日」作为同期群锚点（计算量更小，但可能把窗口起始前已存在的老用户计入某个 cohort） |

响应体包含实际生效的 `mode` 字段，便于前端展示口径说明。

## 事件分析工作台

`POST /api/analytics/events/query` —— 通用事件分析查询，支持按 1–2 个维度分组、多事件名/属性过滤组合筛选，用于替代"为每个新问题写一次专用统计接口"的临时查询场景。

> 服务端权威事件（`source='server'`，如支付、工作流流转、会员注册/积分/优惠券/签到，详见 [埋点采集 SDK · 服务端权威事件](./tracking#服务端权威事件sourceserver)）与前端 SDK 事件写入同一张 `user_events` 表，**无需新增 API**：事件分析工作台的 `eventNames` 下拉、`source` 筛选，以及漏斗分析的每一步定义，均可直接选用/填写这些事件名参与统计。

请求参数：

| 参数 | 说明 |
|------|------|
| `startDate` / `endDate` 或 `days` | 日期范围（`YYYY-MM-DD`），或最近 N 天（1–365），默认 30 |
| `eventNames` | 事件名筛选，最多 20 个 |
| `source` / `appId` / `environment` / `device` | 来源 / 应用 / 环境 / 设备筛选 |
| `propertyFilters` | 属性过滤，最多 10 条，`{ key, op, value }` |
| `segmentId` | 可选，仅统计分群成员 |
| `groupBy` | 分组维度白名单，1–2 维：`date` / `eventName` / `pagePath` / `source` / `appId` / `environment` / `browser` / `os` / `deviceType` / `region` |
| `metric` | `events`（事件数，默认）或 `uv`（去重访客数） |
| `limit` | 结果行数上限，最多 200，默认 100 |

分组维度与属性 key 均通过白名单 / 参数化绑定，禁止任意列名或原始 SQL 片段，防止注入。响应结构：`{ rows: [{ dimensions, value }], total, queryMeta }`。

前端「事件分析」Tab 提供事件多选（可联动事件字典）、指标与维度选择、来源/环境/日期筛选，并以图表 + 表格双视图展示结果。

## 路径分析

`GET /api/analytics/path?days=N&limit=N&startPage=/xxx` —— 页面跳转路径，前端以**桑基图**展示，下方配跳转明细表。

统计口径是**会话内全部相邻跳转**，节点即页面。曾用过「步序 × 页面」建模（第 1 步的 `/` 与第 3 步的 `/` 是两个节点）
以换取天然无环，但后台 SPA 一个会话动辄几十次跳转，按「会话第 N 步」截断会让开头几步之外的所有跳转永远不可见——
实测一个 42 步的会话只有前 4 次跳转能进入统计，新点的页面怎么刷都不出现。

| 参数 | 说明 |
|------|------|
| `days` | 分析窗口天数，1–365，默认 30 |
| `limit` | 按跳转量保留的链路数，1–100，默认 30 |
| `startPage` | 可选起点页；指定后只保留从该页**前向可达**的子图 |

返回 `{ nodes, links, totalTransitions, cyclicValue }`：

- `nodes`：`{ id, label, value }`，`id` 即页面路径，`value` 取进出流量的较大值
  （入口没有入流、退出没有出流，取和会让两端偏小）。
- `links`：`{ source, target, value, cyclic }`。
- `totalTransitions`：全部相邻跳转次数；`cyclicValue`：因破环未进入桑基图的跳转次数。

口径要点：

- **连续重复页面折叠**：同一页面连续上报（刷新、局部跳转）算一次，不会产生自环。
- **退出节点**：会话在某页结束时链路指向 `$exit`（常量 `ANALYTICS_PATH_EXIT_PAGE`，前端渲染为「退出」）。
- **`session_id` 为空的事件被排除**：无法还原会话内顺序，纳入会把不相关访问串成假路径。

### 破环（cyclic 标记）

页面互跳（`/ ⇄ /profile`）让跳转图天然带环，而桑基布局无法表达回边。服务端用
**Eades–Lin–Smyth 贪心反馈弧集**求一个线性序，凡是从后指向前的边标记 `cyclic: true`：

- 桑基图只渲染 `cyclic: false` 的链路，保证喂给布局的是 DAG；
- 明细表展示**全部**链路，回边打「回流·未入图」标签；
- 指标卡与图下说明如实给出被排除的链路数与流量，不做静默丢弃。

> 不用朴素 DFS 定回边：枢纽页（如 `/analytics/behavior`）进出都很重，会被 DFS 最先访问，
> 于是所有回指它的边统统成为回边。贪心序把枢纽排在中间，两侧的边各自成为前向边。

## 用户行为时间线

`GET /api/analytics/user-stats?days=N&limit=N` —— 用户排行：总事件、页面访问、访问页面数、功能使用、总停留与最近活跃时间。

在「用户分析」Tab 点击某用户打开侧边栏，`GET /api/analytics/user-timeline?userId=X`（或 `username=`，最多 500 条）返回该用户完整事件序列（时间 + 事件 + 页面/功能），用于单用户行为回溯。

## 维度分布

- `GET /api/analytics/dimension?dimension=X` —— 按浏览器 / 操作系统 / 设备 / 地域 / 来源 / 引荐 / 页面单维分布，饼图 + 占比表。
- `GET /api/analytics/dimension-cross?dim1=X&dim2=Y` —— 双维交叉分布（如浏览器 × 操作系统），返回交叉矩阵用于组合占比分析。

## Web Vitals 性能接口

`GET /api/analytics/perf-stats` —— 各性能指标的样本数、均值、P75 / P90 / P99 及评级（good / needs-improvement / poor，按 Web Vitals 阈值）。

## 点击分布

- `GET /api/analytics/heatmap-pages` 列出有点击坐标数据的页面与区域；
- `GET /api/analytics/heatmap?pagePath=&componentArea=&days=&deviceType=&source=` 返回归一化坐标点与聚合指标；
- 前端以散点图展示点击落点分布（点大小 / 颜色随点击次数变化），并配套指标卡与两张榜单。

返回内容：

| 字段 | 说明 |
|------|------|
| `points` | 50×50 分箱后的落点（坐标为分箱中心百分比）。每个分箱附带 `topLabel` / `topElementKey` / `topArea`（箱内出现最多的元素文案、key 与 UI 区域）、`uniqueUsers`（落点访客数）、`repeatRate`（人均重复点击 = `value / uniqueUsers`）与 `rage`（主元素是否命中挫败点击） |
| `total` / `uniqueUsers` / `uniqueSessions` / `avgClicksPerUser` | 点击次数、点击访客数、点击会话数与人均点击 |
| `topElements` | 热点元素 TOP 10：元素 key / 文案 / UI 区域、点击次数、点击人数与平均落点 |
| `rageClicks` | 该页面的挫败点击（`$rage_click`）热点元素、发生次数、影响人数与最近发生时间 |

散点图的两个视觉通道各承载一个指标，不再冗余：**点大小 = 点击次数**，**颜色 = 人均重复点击**
（<1.5 绿 / 1.5–2.5 黄 / 2.5–4 橙 / ≥4 红）。1 次/人是正常点击，越高说明少数人在同一处反复点，
通常是交互失效信号。挫败点击事件本身不带坐标，按主元素 key 关联回落点，命中的分箱加深色描边，
使 `rageClicks` 榜单与图联动。

**分箱在 SQL 侧完成**（`GROUP BY` 落点分箱），不再按行采样后在内存聚合，数据量大时不会静默丢点。

> **按设备分开看**：落点坐标是视口百分比，桌面端与移动端的分布不可直接比较，混算会让热区失真。
> `deviceType`（`desktop` / `mobile` / `tablet` / `bot` / `unknown`）与 `source`（`web_admin` / `web_member` / `server`）用于分端与分来源查看，传空字符串表示不筛选，传非法值返回 400。

> 区域维度（`componentArea`）依赖手动接入 `trackAreaClick`（见 [埋点采集 SDK](./tracking#手动埋点-api)）；
> 不选区域时为全页模式，聚合 autocapture 自动采集的视口坐标，无需任何埋点代码。
> 挫败点击事件不带坐标与区域，因此 `rageClicks` 只受页面、时间与设备/来源筛选影响。

## A/B 实验最小闭环

行为中心提供轻量 A/B 实验能力：后台配置实验、SDK 获取分流、自动记录曝光，并在报告中按变体对比转化。管理端点（实验 CRUD 为 `analytics:manage`，列表/详情/报告为 `analytics:view`）：

- `GET /api/analytics/experiments`、`GET /experiments/{id}`：列表 / 详情。
- `POST` / `PUT /{id}` / `DELETE /{id}`：创建 / 更新 / 删除；变体 2–6 个且权重和必须为 100，`expKey` 与变体 key 使用 `^[a-z][a-z0-9_-]*$` 格式。
- `POST /experiments/{id}/start|pause|complete`：状态流转（`draft → running → paused/completed`）。
- `GET /experiments/{id}/report`：实验报告（可选 `startDate` / `endDate`）。
- `GET /experiments/assignments`：**公开分流端点**（匿名可用，`analytics-ingest` 限流），SDK 据此获取分组，匿名 `distinctId` 同样拒绝伪造 `u:` / `m:` 前缀。

核心语义：

- **分流算法**：服务端对 `expKey:distinctId` 做 SHA-256，取前 8 位十六进制转整数后 `mod 100`。未命中 `trafficAllocation` 的用户不参与实验，也不会产生曝光。命中后按变体 `weight` 区间选择 `variantKey`，同一实验和同一 `distinctId` 的结果稳定。
- **无状态分组**：系统不保存 assignment 表。曝光事件本身即为分组记录，事件名为 `$experiment_exposure`，属性包含 `expKey`、`variantKey`。
- **曝光语义**：SDK `getVariant(expKey)` 命中变体时自动上报曝光；同一会话内同一 `expKey + variantKey` 只上报一次。
- **转化口径**：实验报告以每个用户的首次曝光时间为起点，只统计该用户首次曝光之后发生的指标事件（`metricEventName`）为转化，按变体计算曝光用户数、转化用户数和转化率。
- **运行保护**：实验进入 `running` 后不可修改实验标识、参与流量、变体、转化指标和开始时间，避免历史分流漂移；仅允许更新名称、描述、状态和结束时间。

## 分群触达

用户分群（配置见 [数据管理 · 用户分群](./data-management#用户分群)）列表的「触达」操作可创建并执行分群触达活动（`GET/POST /api/analytics/campaigns`、`PUT/DELETE /campaigns/{id}`、`POST /campaigns/{id}/execute`，权限 `analytics:manage`）：

- `email`：按分群快照中的会员/管理员邮箱去重发送邮件模板，支持 `{name}` 变量，每 50 条上报一次任务进度。
- `in_app`：仅对管理员身份创建站内信；会员与匿名身份没有站内信收件箱，会计入失败数。所引用的站内信模板必须存在，否则任务失败。
- `webhook`：使用 SSRF 防护的出站 HTTP 客户端分批 POST（每批 500，10 秒超时）成员快照。

执行通过任务中心异步完成（任务类型 `analytics-campaign-execute`，不自动重试）。活动状态为 `draft/running/completed/failed`；只要有成功发送即标记 `completed`，部分失败通过 `failedCount` 与 `lastError` 体现；全部失败标记 `failed`。若分群成员快照为空，需先执行分群物化。
