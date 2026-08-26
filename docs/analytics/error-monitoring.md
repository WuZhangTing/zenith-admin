# 错误监控

错误监控页面（`/analytics/errors`）提供 6 个 Tab：**错误 Issue / 概览 / 错误事件 / Source Map / 告警规则 / 告警历史**，默认进入「错误 Issue」，覆盖 Issue 分组、堆栈还原、行为面包屑、状态流转与多渠道告警。

## 捕获范围

全局兜底 `useGlobalErrorHandler`（`App` 中挂载一次）自动捕获并上报常见错误，也支持业务手动上报严重崩溃：

| 类型 | 来源 |
|------|------|
| `js_error` | 未捕获的运行时错误（window error） |
| `promise_rejection` | 未处理的 Promise 拒绝（不含约定内拒绝：`ApiError` 业务错误与 `SubmitAborted` 提交中断标记，二者由 request 层或页面自行提示，不进入错误监控） |
| `resource_error` | 图片 / 脚本 / 样式等资源加载失败 |
| `console_error` | `console.error` 调用 |
| `http_error` | 失败的 fetch/XHR 请求（5xx / 网络错误，由 SDK API 监控转报） |
| `white_screen` | 加载后根节点长时间无内容的疑似白屏 |
| `crash` | 业务手动调用 `reportError('crash', ...)` 上报的严重崩溃 |

## 上报链路

`POST /api/frontend-errors`（匿名/登录均可，受 `error-report` IP 限流）。匿名上报同样支持站点 `X-Analytics-Site-Key` 归属租户，并受站点来源白名单约束。

- 每次上报携带最近 30 条**行为面包屑**（导航 / 点击 / 网络 / 控制台）用于还原现场。
- SDK 侧对同一 `type + message` 的错误做 10 秒去重，避免循环报错刷爆队列。
- 载荷截断上限：`message` 2000 字符、`stack` 16000 字符、来源/页面 URL 512 字符。
- 采集设置中的 `errorIgnorePatterns` 按租户配置正则规则，命中 `message` 的错误在服务端丢弃；非法正则被跳过，不影响其他规则。

## Issue 分组模型

相同错误按**指纹**聚合为一个 `error_group`（Issue），每次发生记录为一条 `error_event`：

- 指纹 = `hash(tenantId + environment + errorType + 归一化 message + 顶层堆栈帧 + 来源文件)`；归一化会抹掉数字、UUID、十六进制地址等易变部分，含租户与环境因子保证全局唯一。
- 列表 `GET /api/frontend-errors/groups` 支持按状态 / 类型 / 级别 / 错误信息关键词筛选。
- 概览 `GET /api/frontend-errors/overview` 提供错误种类、未解决数、总发生次数、影响用户、今日新增、趋势与 Top Issues。
- 「错误事件」Tab（`GET /api/frontend-errors/events`）按标准分页平铺查看单次错误事件；Issue 详情可通过 `groupId` 查看该分组的最近事件。
- `error_group_identities` 以 `u:{userId}` / `m:{memberId}` / `a:{sessionId}` 对每个 Issue 去重维护影响用户数，避免详情页临时做大范围 `COUNT(DISTINCT)`。

## 详情

`GET /api/frontend-errors/groups/{id}` 返回：

- 错误信息与堆栈；若已上传对应 release 的 Source Map，自动给出**还原后的源码堆栈**（可切换原始 / 还原）。
- 近 14 天发生趋势、浏览器 / 系统分布、影响用户数。
- 最近事件列表，每条可展开查看面包屑、上下文、UA、HTTP 详情。

## 状态流转与指派

`PUT /api/frontend-errors/groups/{id}`：

- 状态：未解决 / 已解决 / 已忽略 / 已静音；标记已解决记录 `resolvedAt`，**再次发生自动重开**（回归检测：同指纹错误再次上报时 `resolved` 自动翻回 `unresolved` 并清空 `resolvedAt`）。
- 指派处理人、修改级别、添加处理备注。
- 支持批量改状态（`POST /groups/batch-status`）与批量删除（`DELETE /groups/batch`）。
- 清除历史数据：`DELETE /api/frontend-errors/clean?days=N`（权限 `monitor:error:manage`）删除 N 天前的错误事件与关联分组。

## Source Map 堆栈还原

在「Source Map」Tab 管理打包产物的 `.map` 文件（按 `release` + 文件名，文件名需与压缩堆栈中的 bundle 名一致，如 `index-abc.js`）：

- `GET /api/frontend-errors/source-maps` 列表、`POST /source-maps` 上传（replace 语义，重复上传覆盖）、`DELETE /source-maps/{id}` 删除。
- 单个 Source Map 最大 20MB，前后端均会拒绝超限内容。
- 构建过程自动注入应用版本（可用 `VITE_APP_VERSION` 覆盖），错误上报的 `release` 必须与上传时填写的 Release 一致。
- 详情页自动将压缩堆栈逐帧映射回源码位置（基于 `source-map` 库）。

## 告警规则

在「告警规则」Tab 配置（查看 `monitor:alert:list`，管理 `monitor:alert:manage`）：

- **条件**：新错误（`new_error`，出现新指纹分组即命中）/ 阈值（`threshold`，时间窗口内错误数 ≥ 阈值）/ 激增（`spike`，当前窗口错误数 ≥ 阈值且超过上一窗口的 2 倍）。
- 可按错误类型、级别过滤；阈值次数 1–100000，时间窗口 1–10080 分钟。
- **通知渠道**（`email` / `webhook` / `inapp` 站内信）：启用规则必须至少选择一个渠道；`webhook` 必须配置 URL，`email` / `inapp` 必须配置接收人。
- Webhook 外呼启用 SSRF 防护，拒绝本机、私网及云元数据地址（8 秒超时）。
- **测试发送**：`POST /api/frontend-errors/alerts/{id}/test` 按规则当前渠道配置发送一条测试通知，验证可达性，不影响去抖状态。

### 评估与去抖

- 定时任务 `evaluateErrorAlerts` 每 5 分钟评估全部启用规则；此外错误上报落库时**实时评估**一次（`new_error` 条件由新分组判定直接短路，`threshold` / `spike` 复用窗口计数），新错误告警无需等下一个周期。
- **去抖**：命中后通过条件 UPDATE 原子推进 `lastTriggeredAt` 抢占触发权——同一规则在一个时间窗口（`windowMinutes`）内最多触发一次，多实例并发评估也不会重复通知。
- 每次触发写入 `error_alert_logs`（规则快照、命中详情、投递渠道），在「告警历史」Tab（`GET /api/frontend-errors/alert-logs`，权限 `monitor:alert:list`）分页查看。
