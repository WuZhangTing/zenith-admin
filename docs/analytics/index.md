# 数据分析与监控 · 总览

Zenith Admin 内置了一套对标 GA4 / PostHog / 神策 / Sentry 的**前端数据分析与错误监控系统**，无需任何外部服务即可完成行为采集、多维分析、埋点治理、A/B 实验、用户分群触达与错误监控告警。本章按模块拆分讲解功能与用法。

## 章节导航

| 文档 | 内容 |
|------|------|
| [埋点采集 SDK](./tracking) | 自动采集（页面/点击/性能/API/Rage Click/滚动深度）、手动埋点 API、声明式 `data-track`、上报字段、远程配置热更新、批量上报、离线重试、隐私脱敏、A/B 实验分流、站点 siteKey、服务端权威事件 |
| [行为分析](./behavior) | 概览 KPI、趋势（支持环比对比）、实时、页面停留、功能使用、会话与会话时间轴、漏斗（有序转化 + 转化窗口 + 分群限定 + 保存报表）、留存（真实首访/窗口首现双口径）、路径、用户时间线、维度分布与双维交叉、Web Vitals、点击分布、事件分析工作台、A/B 实验、分群触达 |
| [数据管理](./data-management) | 事件明细与导出、事件字典（Tracking Plan）、租户级事件覆盖、埋点质量看板、实时事件调试、用户分群（CRUD + 异步物化）、站点管理与配额、每日聚合、采集设置、数据保留策略、报表中心复用 |
| [错误监控](./error-monitoring) | Issue 分组模型、捕获范围、Source Map 堆栈还原、行为面包屑、状态流转/指派、告警规则与触发历史 |
| [架构与数据模型](./architecture) | 19 张数据表、路由与 Service 分层、数据链路、WebSocket 事件、定时任务与异步任务、权限码、多租户隔离 |
| [容量演进与架构触发条件](./capacity) | 当前 PostgreSQL 基线、触发阈值、自查 SQL、PG 分区优先路径、队列 + OLAP 后续路径、不立项能力评估 |

## 设计理念

- **全自动优先**：页面浏览、元素点击、Web Vitals、API 异常默认全自动采集，无需逐页埋点；需要语义化业务事件时再用 `trackEvent` 显式补充，支付/工作流/会员等关键事件由服务端权威写入。
- **零外部依赖**：采集、存储、分析、告警全部基于项目自带的 PostgreSQL + Redis + pg-boss，离线可用。
- **采集即治理**：事件进入存储前经过 Tracking Plan 治理（全局屏蔽、租户覆盖、严格模式 schema 校验），质量问题落埋点质量看板，站点维度支持来源白名单与日配额。
- **多租户隔离**：行为与错误数据按 `tenantId` 隔离；匿名上报按站点 `siteKey` 归属租户，错误指纹含租户因子保证分组全局唯一，事件字典按事件名全局治理。

## 数据流

```text
前端 Tracker SDK (@zenith/analytics-sdk)
  · 自动采集 + Web Vitals + API 监控 + 批量上报 + 离线重试 + 远程配置热更新
        ↓ 批量上报（匿名/登录均可，匿名可带站点 siteKey）
POST /api/analytics/events           埋点事件
POST /api/frontend-errors            错误上报（含面包屑/上下文）
        ↓ 站点解析 / 来源白名单 / Tracking Plan 治理 / 日配额
        ↓ 服务端解析 UA / IP、计算指纹、维护会话与用户画像
PostgreSQL（19 张表）+ Redis（站点配额计数）
        ↓ 聚合分析接口
GET  /api/analytics/*                概览/趋势/会话/漏斗/留存/路径/维度/实时/事件分析/实验报告…
GET  /api/frontend-errors/*          概览/分组/详情(还原)/事件/告警规则/告警历史…
        ↓ 定时任务（pg-boss）+ 任务中心异步任务
analyticsRollupDaily / analyticsRetention / evaluateErrorAlerts
聚合重建 / 分群物化 / 触达执行
```

## 后台页面与权限

| 页面 | 路径 | 权限码 |
|------|------|--------|
| 行为分析 | `/analytics/behavior` | `analytics:view` |
| 数据管理 | `/analytics/data` | `analytics:manage` / `analytics:export` / `analytics:clean` |
| 错误监控 | `/analytics/errors` | `monitor:error:list` / `monitor:error:manage` / `monitor:alert:list` / `monitor:alert:manage` |

> 超级管理员默认拥有全部权限；其他角色需在「角色管理」中分配对应权限码。
