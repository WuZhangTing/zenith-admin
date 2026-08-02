# 维护模式

维护模式用于发布 / 迁移窗口期临时封禁业务 API：开启后普通用户请求被 503 拦截，超级管理员不受影响，可以继续在线操作并随时关闭。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| 拦截中间件 | `packages/server/src/middleware/maintenance.ts` |
| 状态与记录 service | `packages/server/src/services/ops/maintenance.service.ts` |
| 路由 | `packages/server/src/routes/ops/maintenance.ts` |

## 拦截行为

`maintenanceMiddleware` 挂载在 `/api/*`（`src/app.ts`），开启维护模式后：

```json
// HTTP 503
{ "code": 503, "message": "系统维护中，请稍后重试", "data": null }
```

### 豁免规则

1. **路径豁免**（`BYPASS_PREFIXES`）：`/api/health`、`/api/auth/`（登录必须可用，否则超管进不来）、`/api/maintenance/status`、`/metrics`、`/api/ws`
2. **超级管理员豁免**：Bearer token 校验通过且角色含超管编码 → 放行；token 无效则按普通用户拦截

### 状态缓存

维护状态存 `maintenance_mode` 表（单行 upsert，`id = 1`），中间件读取走 **5 秒内存缓存**（`getMaintenanceStatus`），避免每请求查库；更新后立即 `invalidateMaintenanceCache()`，本进程即时生效，多实例部署最多延迟 5 秒。

## API 端点

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/maintenance/status` | **公开** | 维护状态（前端登录页 / 维护提示页轮询用） |
| GET | `/api/maintenance` | `system:maintenance:manage` | 维护模式详情 |
| PUT | `/api/maintenance` | `system:maintenance:manage`（带审计） | 开启 / 关闭 / 更新提示 |
| GET | `/api/maintenance/logs` | `system:maintenance:manage` | 维护时段记录分页（可按 `ongoing` / `completed` 过滤） |

`PUT` 请求体：

```json
{
  "enabled": true,
  "message": "系统升级中，预计 30 分钟后恢复",
  "estimatedEndAt": "2025-06-01 03:00:00"
}
```

状态字段包含 `enabled`、`message`、`estimatedEndAt`、`startedAt`、`startedByName`、`updatedAt`——开启时自动记录操作人与开始时间。

## 维护时段记录

每次状态迁移自动落 `maintenance_logs` 表（在同一事务内）：

| 迁移 | 行为 |
| --- | --- |
| 关 → 开 | 新增一条进行中记录（开始时间、操作人、提示语） |
| 开 → 关 | 结束当前记录：写结束时间、操作人、**结算时长**（秒） |
| 开 → 开 | 仅更新进行中记录的提示语与预计结束时间 |

管理页面据此展示历史维护窗口与时长统计。

## 前端联动

- 开启 / 关闭维护模式的 PUT 操作会记入[审计日志](./audit-log-changes.md)（模块「维护模式」，带 before/after 快照）
- 普通用户收到 503 后，前端跳转维护提示页并轮询 `GET /api/maintenance/status`，恢复后自动返回
- 超管界面顶部显示维护中横幅，避免忘记关闭

## 典型发布流程

```text
1. PUT /api/maintenance { enabled: true, message, estimatedEndAt }
2. 执行数据库迁移 / 部署新版本（超管可全程在线验证）
3. 验证通过后 PUT { enabled: false } —— 时长自动结算入维护记录
```
