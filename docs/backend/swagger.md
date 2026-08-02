# Swagger / OpenAPI 文档

Zenith Admin 后端集成了 Swagger UI，开发时可直接在浏览器中浏览、调试所有 REST 接口，无需借助外部工具。

---

## 访问地址

| 路径                     | 说明                                              |
|--------------------------|---------------------------------------------------|
| `GET /api/docs`          | Swagger UI 交互式界面                             |
| `GET /api/openapi.json`  | OpenAPI 3.1 JSON Spec（可导入 Postman / Apifox）  |
| `GET /metrics`           | Prometheus 文本指标端点（非 OpenAPI 端点）        |

默认开发环境地址：

- **Swagger UI**：`http://localhost:3300/api/docs`
- **JSON Spec**：`http://localhost:3300/api/openapi.json`
- **Metrics**：`http://localhost:3300/metrics`

> `GET /api/docs`、`GET /api/openapi.json` 与 `GET /metrics` 均**无需认证**，可直接访问。

## 非 OpenAPI 运维端点

以下端点由服务端直接暴露，但不属于 Swagger / OpenAPI 文档：

| 路径 | 说明 |
| --- | --- |
| `GET /metrics` | Prometheus 文本格式指标，用于被 Prometheus Server 抓取 |

这类端点不返回 JSON schema，也不面向前端业务调试，因此不会出现在 `/api/openapi.json` 中。

---

## 鉴权方式

所有需要登录的接口均使用 **Bearer Token** 认证。在 Swagger UI 中调试前需先完成授权：

1. 调用 `POST /api/auth/login` 获取 `accessToken`
2. 点击 Swagger UI 右上角 **Authorize** 按钮
3. 在弹窗的 `BearerAuth` 输入框中填入 Token 值，格式：`Bearer <accessToken>`
4. 点击 **Authorize → Close**，后续所有请求将自动携带该 Token

---

## 导入 Postman / Apifox

1. 打开 Postman 或 Apifox
2. 选择 **Import → URL**
3. 填入 JSON Spec 地址：`http://localhost:3300/api/openapi.json`
4. 导入完成后即可看到所有接口分组

---

## Spec 维护

OpenAPI Spec **自动生成**，由 `@hono/zod-openapi` 在运行时从每个路由文件的 `createRoute(...)` 声明中汇总。**无需维护任何静态文件**。

### 新增接口时的更新步骤

1. 在路由文件中用 `createRoute(...)` 声明新接口（设好 `method`、`path`、`tags`、`request`、`responses`）
2. 确保路由已在所属业务域的 `packages/server/src/routes/{业务域}/index.ts` 的 `defineRouteDomain` 挂载清单中声明（新增域需同步加入 `routes/index.ts` 的 `ROUTE_DOMAINS`）
3. 运行 `src/app.routes.test.ts` 并更新路由表快照（该测试锁定全量 method + path 清单）
4. 刷新 Swagger UI 即可看到新接口

---

## 接口分组

接口按业务域挂载（`ROUTE_DOMAINS` 顺序：ops → identity → member → platform → files → tasks → analytics → report → messaging → payment → open-platform → workflow → chat → mp → biz-demo → ai → cms），每个接口通过 `tags` 归入分组。

> 以下仅列出核心分组，完整 Tag 列表请以 `/api/docs` Swagger UI 为准。

| 标签 | 说明 |
| --- | --- |
| 认证 | 登录、登出、Token 刷新、验证码 |
| 用户管理 | 用户 CRUD 及登录锁定解除 |
| 角色管理 | 角色 CRUD 及菜单权限分配 |
| 菜单管理 | 菜单 / 按钮权限树管理 |
| 部门管理 | 组织架构 CRUD |
| 岗位管理 | 岗位 CRUD |
| 用户组 | 用户组与成员管理 |
| 企业认证 | SSO 身份提供方（OAuth / OIDC / SAML / LDAP）与企业登录 |
| 字典管理 | 数据字典及字典项 CRUD |
| 操作日志 | 系统操作日志查询（含变更 diff） |
| 登录日志 | 登录历史查询 |
| IP 访问日志 | IP 访问控制命中记录 |
| 限流规则 | 接口级限流规则管理 |
| 系统配置 | 内置系统配置项的读写 |
| 定时任务 | 定时任务管理及执行历史 |
| 系统调度 | 系统级周期任务的统一调度中心 |
| 任务中心 | 异步任务查询、取消、断点恢复与类型策略配置 |
| 导出中心 | 导出任务提交、进度查询与文件下载 |
| 文件管理 | 文件上传、下载及存储配置 |
| 业务附件 | 业务文件附件关联 |
| 通知公告 | 通知发布与已读状态 |
| 会话管理 | 在线会话查询与强制下线 |
| 数据库备份 | 备份任务创建、状态查询及删除 |
| 数据库管理 | SQL 查询、元数据与收藏 |
| 数据脱敏 | 脱敏规则配置与导出脱敏 |
| 邮件 / 短信 / 站内信 | 模板、通道配置与发送日志 |
| 渠道管理 | 消息渠道接入与投递 |
| 工作流 | 流程定义、实例、待办、委托、自动化与触发器 |
| 租户管理 | 多租户 CRUD（开启多租户模式时可见） |
| 支付中心 | 应用、订单、退款、对账、分账、结算、风控与回调 |
| 会员体系 | 会员、等级、积分、钱包、优惠券与签到 |
| 报表中心 | 数据源、数据集、仪表盘、订阅、投递与打印 |
| CMS | 站点、栏目、内容、素材、发布、采集与全文检索 |
| 公众号 | 微信公众号粉丝、菜单、素材、群发与回调 |
| 开放平台 | 开发者应用、API 授权范围、签名与调用统计 |
| 规则引擎 | 决策表、决策流与名单库 |
| 聊天 | 会话、消息、机器人与 Webhook |
| AI | AI 提供方、对话、提示词、知识库与用量 |
| 埋点分析 | 用户行为事件、会话与统计聚合 |
| 前端错误 | 错误聚合、事件、告警与 Source Map |
| OAuth2 | OAuth2 客户端、授权与 Token |
| 终端 / SSH / SFTP | 终端会话、录屏、文件与 SSH/SFTP 配置 |
| 维护模式 | 维护开关与公开维护信息 |
| 运维工具 | 进程、端口、Docker、网络诊断、systemd、防火墙、Nginx 站点、SSL 证书与日志查看 |
| 缓存管理 | Redis 缓存查看与清理 |
| 仪表盘 | 统计数据汇总接口 |
| 服务状态 | 健康检查，无需认证 |
