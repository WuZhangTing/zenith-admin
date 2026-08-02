# 审计日志

系统的操作审计由 `guard` 中间件统一实现：写操作声明 `audit` 配置后，自动记录操作人、请求、响应与**变更前后数据快照**（diff 展示），落 `operation_logs` 表。登录 / 登出行为单独记 `login_logs`。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| guard 中间件（权限 + 审计） | `packages/server/src/middleware/guard.ts` |
| 快照辅助（零参版） | `packages/server/src/lib/context.ts` |
| 表结构 | `packages/server/src/db/schema/logs.ts` |
| 查询路由 | `routes/platform/operation-logs.ts`、`routes/identity/login-logs.ts` |

## 声明审计

在路由的 `guard` 中传 `audit`：

```ts
middleware: [authMiddleware, guard({
  permission: 'system:user:update',
  audit: { description: '更新用户', module: '用户管理' },
})] as const
```

`AuditLogOptions`：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `description` | — | 操作描述（必填） |
| `module` | — | 所属模块（列表筛选用） |
| `recordBody` | `true` | 是否记录请求体；文件上传等场景传 `false` |
| `recordResponseBody` | `true` | 是否记录完整响应体；返回一次性密钥等敏感响应传 `false` |

## 自动采集内容

每条操作日志（`operation_logs`）包含：

- **操作人**：userId、username、归属租户（`getEffectiveTenantId`：租户用户记自身租户，平台超管在租户视角记该租户、平台视角记 null）
- **请求**：method、path、requestId、请求体（`sanitizeBody` 脱敏后**截断 4096 字符**；校验失败的 400 请求也会记录原始 body，便于审计异常请求）
- **响应**：状态码、完整响应体（**截断 16KB**）、耗时
- **环境**：客户端 IP（走受信代理解析）、IP 归属地、User-Agent、OS、浏览器
- **数据快照**：`beforeData` / `afterData`（见下节）

写入时机：响应发出后经 `setImmediate` 异步落库，**不增加请求延迟**；日志写入失败不影响主流程。

### 请求体脱敏

`sanitizeBody`（`src/lib/sanitize.ts`）深度遍历 JSON，键名命中敏感词（`password`、`secret`、`token`、`accessKey`、`privateKey`、`apiKey`、`clientSecret`、`refreshToken`、`credential`、`webhook` 等）的字段替换为 `***`。

## 变更前后快照（diff）

### afterData 自动捕获

响应体为标准信封（`code: 0` 且 `data` 非空）时，`data` 自动作为 `afterData`——大多数更新接口返回更新后实体，无需额外代码。

### beforeData 手动注入

更新 / 删除操作在改动前注入旧数据快照：

```ts
import { setAuditBefore } from '../../lib/context';

handler: async (c) => {
  const { id } = c.req.valid('param');
  setAuditBefore(await getUserById(id));   // 零参上下文版，无需透传 c
  const updated = await updateUser(id, c.req.valid('json'));
  return c.json(okBody(updated), 200);
},
```

等价的 Context 版本：`setAuditBeforeData(c, data)`（`middleware/guard.ts`）。

### afterData 手动注入

删除等响应 `data` 为 null 的操作，可用 `setAuditAfter(data)` / `setAuditAfterData(c, data)` 显式提供操作后快照。

前端操作日志详情页对 `beforeData` / `afterData` 做字段级 diff 高亮展示。

## 查询与管理端点

操作日志（权限 `system:log:operation`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/operation-logs` | 分页查询（按模块 / 操作人 / 时间 / 状态码筛选） |
| GET | `/api/operation-logs/stats` | 统计 |
| DELETE | `/api/operation-logs/clean` | 清空 |

登录日志（`login_logs`，登录 / 登出各记一条，含成功与失败）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/login-logs` | 分页查询 |
| GET | `/api/login-logs/stats` | 统计 |
| DELETE | `/api/login-logs/clean` | 清空 |

`login_logs` 除 IP / 归属地 / 浏览器 / OS 外，还记录前端上报的设备信息（分辨率、DPR、GPU、CPU 核数、内存）用于风控分析。

## 使用建议

- **只审计写操作**：GET 查询不声明 `audit`，避免日志膨胀
- `description` 用「动词 + 对象」：「新增角色」「重置用户密码」
- 涉及敏感响应（密钥、token 明文）务必 `recordResponseBody: false`
- 与 [HTTP 流量日志](./http-logging.md) 的分工：审计日志面向合规追溯（业务视角、入库可查），流量日志面向排障（技术视角、写日志文件）
