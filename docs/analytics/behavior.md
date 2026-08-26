# 行为分析

行为分析页面（`/analytics/behavior`，权限 `analytics:view`）提供 13 个 Tab：**概览 / 实时 / 事件分析 / A/B 实验 / 页面停留 / 功能使用 / 会话 / 漏斗 / 留存 / 路径 / 用户分析 / 点击分布 / 获客归因**，以折线、面积、柱状、饼图、热力矩阵、桑基图和点击散点图呈现。多数统计接口支持 `days`（1–365）/ `limit` 查询，概览、页面停留、功能使用、漏斗、路径、用户分析、点击分布、获客归因共享近 7 / 14 / 30 / 90 天区间；会话列表支持用户名与设备筛选。漏斗与留存支持统一的**对比轴**（维度拆分 / 群组对比）与**图表下钻**（点击到具体用户名单）。

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
- `comparison`：对比轴（见下方「对比轴」），默认 `{ "type": "none" }`。

```jsonc
// 请求体示例
{ "days": 30, "conversionWindowHours": 72,
  "comparison": { "type": "dimension", "dimension": "channel" },
  "steps": [
    { "label": "进入首页", "pagePath": "/" },
    { "label": "浏览列表", "eventName": "$pageview" },
    { "label": "提交订单", "eventName": "order_submit",
      "properties": [{ "key": "amount", "op": "gte", "value": 100 }] }
  ] }
```

响应结构统一为 `{ series: [...], comparison }`，无对比时 `series` 长度为 1（key 为 `__overall__`），
前端只需一条渲染路径。

**对比轴只作用于漏斗起点**：漏斗语义是「从同一批人出发」，若每一步都按维度过滤，
用户中途换设备/换渠道就会被算作流失，转化率被系统性低估。

**保存报表**：配置好的漏斗可保存复用——`GET /api/analytics/reports?type=funnel` 列表、`POST /api/analytics/reports` 保存、`DELETE /api/analytics/reports/{id}` 删除（均 `analytics:view` 权限，按创建人隔离，落 `analytics_saved_reports` 表）。保存的配置包含对比轴。

## 对比轴（breakdown 维度 / 群组对比）

漏斗与留存共用同一条对比轴，来源二选一，**不做「维度 × 分群」组合**——
两者叠加会产生笛卡尔积序列，图表无法阅读，且每条序列的样本量被摊薄到失去统计意义。

| `comparison` | 说明 |
|--------------|------|
| `{ "type": "none" }` | 不对比，返回单条 `__overall__` 序列 |
| `{ "type": "dimension", "dimension": "channel" }` | 按维度拆分，保留 Top 6，长尾合并为 `__other__`「其他」 |
| `{ "type": "segments", "segmentIds": [1, 2] }` | 按分群对比，最多 3 个 |

可用维度：`browser` / `os` / `deviceType` / `region` / `country` / `source` / `appId` /
`environment` / `channel` / `utmSource` / `utmMedium` / `utmCampaign` / `referrerHost`。

维度拆分保留长尾「其他」序列，是为了让各序列之和等于总量——不合并的话看图的人会以为数据丢了。
来源类维度（UTM / referrer）的空值语义是「没有来源」，展示为「直接访问」而非「未知」。

## 留存分析

`POST /api/analytics/retention` —— cohort 留存矩阵，前端以热力矩阵呈现，行=同期群、列=第 N 个周期，单元格颜色深浅表示留存率。请求体含 `days` / `mode` / `periodType` / `maxPeriods` / `comparison`。

> 留存用 POST 而非 GET：对比轴是判别联合对象，query string 无法自然承载。

响应同样是 `{ series, periods, mode, periodType, days, comparison }`。每条序列除 `cohorts` 外还带
`averages`（各周期的**加权平均**留存率，按队列规模加权）与 `totalUsers`。
加权而非算术平均：算术平均会让一个 3 人的小队列和一个 3 万人的大队列等权，
多序列对比时结论会被噪音主导；尚未走到该周期的队列（值为 `null`）不参与平均，
否则新队列会把留存率稀释成 0。

**周期粒度（`periodType`）** 决定队列与回访的分桶方式，队列起点与 PostgreSQL `date_trunc` 对齐（周从周一起算，月从 1 日起算）。各粒度的回溯窗口（`days`）与列数（`maxPeriods`）默认值与上限如下（定义于 `ANALYTICS_RETENTION_PERIOD_LIMITS`）：

| `periodType` | `days` 默认 / 上限 | `maxPeriods` 默认 / 上限 |
|--------------|-------------------|-------------------------|
| `day`（日留存） | 14 / 90 | 8 / 30 |
| `week`（周留存） | 84 / 365 | 8 / 26 |
| `month`（月留存） | 365 / 730 | 6 / 24 |

> 周/月留存需要远大于 60 天的回溯窗口才能填满矩阵：12 周留存至少需要 84 天原始数据，12 个月留存至少需要 365 天。实际列数取 `min(maxPeriods, 队列轴长度)`，避免出现整列为空的占位列。

支持两种同期群口径（`mode`，默认 `first_seen`）：

| 口径 | 说明 |
|------|------|
| `first_seen`（默认，真实首访） | 在**租户全部历史数据**中计算每个 `distinctId` 的真正首次出现日期，仅保留首次出现日落在当前分析窗口（`days`）内的用户作为同期群；日期过滤不会提前作用于「首次出现」这一判定本身，避免把老用户误判为新用户 |
| `window_first` | 以当前查询窗口内的「窗口内首现日」作为同期群锚点（计算量更小，但可能把窗口起始前已存在的老用户计入某个 cohort） |

响应体包含实际生效的 `mode` 字段，便于前端展示口径说明。

## 事件分析工作台

`POST /api/analytics/events/query` —— 通用事件分析查询，支持按 1–2 个维度分组、多事件名/属性过滤组合筛选，用于替代"为每个新问题写一次专用统计接口"的临时查询场景。

> 服务端权威事件（`source='server'`，如支付、工作流流转、会员注册/积分/优惠券/签到，详见 [埋点采集 SDK · 服务端权威事件](./tracking#服务端权威事件-source-server)）与前端 SDK 事件写入同一张 `user_events` 表，**无需新增 API**：事件分析工作台的 `eventNames` 下拉、`source` 筛选，以及漏斗分析的每一步定义，均可直接选用/填写这些事件名参与统计。

请求参数：

| 参数 | 说明 |
|------|------|
| `startDate` / `endDate` 或 `days` | 日期范围（`YYYY-MM-DD`），或最近 N 天（1–365），默认 30 |
| `eventNames` | 事件名筛选，最多 20 个 |
| `source` / `appId` / `environment` / `device` | 来源 / 应用 / 环境 / 设备筛选 |
| `propertyFilters` | 属性过滤，最多 10 条，`{ key, op, value }` |
| `segmentId` | 可选，仅统计分群成员 |
| `groupBy` | 分组维度白名单，1–2 维：`date` / `eventName` / `pagePath` / `source` / `appId` / `environment` / `browser` / `os` / `deviceType` / `region` |
| `metric` | 见下方「指标」 |
| `metricProperty` | 数值属性 key，`sum`/`avg`/`min`/`max`/`p50`/`p90`/`p95` 必填 |
| `limit` | 结果行数上限，最多 200，默认 100 |

**指标**：

| 指标 | 说明 |
|------|------|
| `events` | 事件次数（默认） |
| `uv` | 去重访客数 |
| `eventsPerUser` | 人均次数（事件数 / 去重访客数） |
| `sum` / `avg` / `min` / `max` | 数值属性的求和 / 均值 / 极值 |
| `p50` / `p90` / `p95` | 数值属性的中位数 / P90 / P95 |

数值指标作用于 `properties->>key`。**jsonb 里同名属性的类型不受控**——同一个 `amount`
可能既有 `12.5` 也有 `"N/A"`，直接 `::numeric` 会让一行脏数据把整条查询打崩。
因此服务端先用正则筛出合法数值再转换，非数值行按「不参与计算」处理（与 SQL 聚合忽略 NULL 一致）；
同时附加 `properties ? key` 条件，把没有该属性的事件排除在分母外，避免 `avg` 被无关事件稀释。

分组维度与属性 key 均通过白名单 / 参数化绑定，禁止任意列名或原始 SQL 片段，防止注入。响应结构：`{ rows: [{ dimensions, value }], total, queryMeta }`。

前端「事件分析」Tab 提供事件多选（可联动事件字典）、指标与维度选择、来源/环境/设备/日期筛选、分群限定，以及**属性过滤条件构建器**（最多 10 条，条件间为「且」关系；`in` 运算符的取值在输入框内用英文逗号分隔），并以图表 + 表格双视图展示结果。key 或值未填完整的条件行不会提交，避免服务端因空 key 返回 400。

> 属性过滤的 SQL 会在 `properties ->> key` 比较之外附加一个 `properties ? key` 键存在合取项。
> 该条件被除 `neq` 外的所有运算符逻辑蕴含（结果集不变），但能命中 `user_events.properties`
> 上的 GIN 索引（默认 `jsonb_ops`），把「时间窗内逐行求值 jsonb 表达式」降级为位图索引扫描 + 精确重查。
> `neq` 语义上包含「该 key 不存在」的行，故不附加该条件。

## 图表下钻用户列表

`POST /api/analytics/drill-users` —— 把图表坐标翻译成具体的用户名单。

漏斗告诉你「第 3 步流失了 3000 人」、留存告诉你「第 2 周掉了 60%」，但看不到「是谁」，
分析结论就无法转化为运营动作。下钻接口补上这一环。

请求体为 `{ context, page, pageSize }`，`context` 是判别联合：

| `context.type` | 定位坐标 | `outcome` |
|----------------|----------|-----------|
| `funnel` | `stepIndex`（0 基）+ 漏斗完整配置 | `converted`（到达该步）/ `dropped`（到达上一步但没到该步） |
| `retention` | `cohortDate` + `periodIndex`（0 基）+ 留存配置 | `retained`（该周期仍活跃）/ `churned`（属于该队列但该周期未活跃） |

两种 context 都可带 `comparison` + `seriesKey`，用于在多序列图表上定位到具体那条线。

**一致性要求**：下钻复用产生该图表的同一套 SQL 构造（漏斗 CTE、留存分桶、对比轴条件），
所以 `context` 里的分析参数必须与图表查询一致；否则「图上 3000 人」和「下钻出 2874 人」
这种对不上的数字会直接摧毁使用者对数据的信任。

约束与设计取舍：

- 首步不存在「流失」（没有上一步），schema 层直接拒绝该组合——放行只会静默返回空列表，
  让人误以为「没有人流失」。
- 单页最多 100 条：下钻用于定位问题用户，不是全量导出。
- 画像用 `LEFT JOIN LATERAL ... LIMIT 1` 而非普通 JOIN：平台视角下无租户过滤，
  同一 `distinctId` 可能在多个租户各有一条画像，普通 JOIN 会把一个用户放大成多行，
  分页与「命中人数」立刻对不上。缺画像的用户仍会列出（下钻的意义正是找出这些人）。

> **为什么没有「一键存为分群」**：分群规则 schema 只支持 event / attribute 两类原子条件，
> 无法表达「漏斗第 N 步流失」「留存第 D 周期未回访」这类跨步序的集合语义。
> 硬塞会得到一个与下钻结果不等价的分群，比没有更危险。

## 获客与归因报表

`GET /api/analytics/acquisition?days=N&dimension=...&model=...&conversionEvent=...&limit=N`

与事件分析工作台 `groupBy` 的关键区别：事件分析按**事件**计数，同一用户多次访问会重复计入；
本报表按**用户**归因——每个用户只归属于一条触点，因此各行用户数之和等于总用户数，
可以直接用来比较渠道贡献。

**归因模型**决定把转化算给哪一次触点。一个用户往往有多次触点（先自然搜索进来、
几天后点广告回来再下单），算给谁结论完全不同，因此报表必须显式声明模型：

| `model` | 口径 | 回答的问题 |
|---------|------|-----------|
| `first_touch` | 窗口内最早一次触点 | 谁把用户带来的（拉新贡献） |
| `last_touch` | 窗口内最后一次触点（默认） | 谁临门一脚（促单贡献） |

`dimension` 可选 `channel` / `utmSource` / `utmMedium` / `utmCampaign` / `referrerHost`。

**渠道（channel）派生规则**（优先级自上而下）：`utm_medium` 显式声明付费/邮件/社交 →
以声明为准；有 `utm_source` 但 medium 未声明 → 按 source 域名特征归类；
无 UTM 但有 referrer → 按 referrer 域名特征归类；两者都无 → 直接访问。
渠道枚举：`direct` / `organic_search` / `paid_search` / `social` / `email` / `referral` / `other`。

返回每行的 `users` / `newUsers` / `sessions` / `conversions` / `conversionRate`。
`newUsers` 按**全历史首见时间**判定，而不是「窗口内首次出现」——后者会把老用户的回访误计为新用户。
`conversionEvent` 留空时只看流量结构，不算转化。

## 路径分析

`GET /api/analytics/path?days=N&limit=N&startPage=/xxx` —— 页面跳转路径，前端以**桑基图**展示，下方配跳转明细表。

统计口径是**会话内全部相邻跳转**，节点即页面路径。服务端保留完整相邻跳转，再对回边做 `cyclic` 标记，
保证明细表覆盖全部链路，桑基图只渲染可布局的无环子图。

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

散点图的两个视觉通道各承载一个指标：**点大小 = 点击次数**，**颜色 = 人均重复点击**
（<1.5 绿 / 1.5–2.5 黄 / 2.5–4 橙 / ≥4 红）。1 次/人是正常点击，越高说明少数人在同一处反复点，
通常是交互失效信号。挫败点击事件本身不带坐标，按主元素 key 关联回落点，命中的分箱加深色描边，
使 `rageClicks` 榜单与图联动。

**分箱在 SQL 侧完成**（`GROUP BY` 落点分箱），避免按行采样后在内存聚合导致数据量大时静默丢点。

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
- **统计推断**：报告以变体列表首项为对照组，对其余变体做**双比例 Z 检验**（双尾，α=0.05），输出 p 值、绝对提升（百分点）、相对提升与 95% 置信区间。p 值用合并比例（pooled）计算标准误（原假设「两组比例相等」下的正确口径），置信区间用各组各自比例（unpooled）计算，两者不混用，避免出现「显著但区间跨 0」的矛盾结论。任一组的成功数或失败数不足 5 时正态近似不成立，此时报告标记「样本过少 · p 值不可信」，而非直接判为不显著。
- **分流健康度（SRM）**：报告对各变体实际曝光数与配置权重做卡方拟合优度检验，p < 0.001 判定为样本比例失衡并在报告顶部红色告警。SRM 命中意味着分流链路本身有问题（SDK bug、缓存、重复曝光），此时转化率对比不可信，应先修分流再看结论。
- **样本量参考**：按对照组当前转化率估算「检测 10% 相对提升、80% 统计功效」所需的每组曝光量；未达该量级时报告提示样本不足，提醒「不显著」只代表证据不够，不代表没有效果。
- **运行保护**：实验进入 `running` 后不可修改实验标识、参与流量、变体、转化指标和开始时间，避免历史分流漂移；仅允许更新名称、描述、状态和结束时间。

## 分群触达

用户分群（配置见 [数据管理 · 用户分群](./data-management#用户分群)）列表的「触达」操作可创建并执行分群触达活动（`GET/POST /api/analytics/campaigns`、`PUT/DELETE /campaigns/{id}`、`POST /campaigns/{id}/execute`，权限 `analytics:manage`）：

- `email`：按分群快照中的会员/管理员邮箱去重发送邮件模板，支持 `{name}` 变量，每 50 条上报一次任务进度。
- `in_app`：仅对管理员身份创建站内信；会员与匿名身份没有站内信收件箱，会计入失败数。所引用的站内信模板必须存在，否则任务失败。
- `webhook`：使用 SSRF 防护的出站 HTTP 客户端分批 POST（每批 500，10 秒超时）成员快照。

执行通过任务中心异步完成（任务类型 `analytics-campaign-execute`，不自动重试）。活动状态为 `draft/running/completed/failed`；只要有成功发送即标记 `completed`，部分失败通过 `failedCount` 与 `lastError` 体现；全部失败标记 `failed`。若分群成员快照为空，需先执行分群物化。
