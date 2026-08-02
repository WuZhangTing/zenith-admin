# WebSocket 事件

系统通过单一 WebSocket 连接（`/api/ws`）向前端实时推送通知、聊天、审批、支付等事件。消息契约是 `@zenith/shared/platform` 的 `WsMessage` 联合类型——**前后端共用，新增事件必须先在该类型中登记**。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| 连接管理 / 发送 API | `packages/server/src/lib/ws-manager.ts` |
| 连接路由（鉴权、心跳、信令中继） | `packages/server/src/routes/platform/ws.ts` |
| 群通话房间 | `packages/server/src/lib/rtc-manager.ts` |
| 消息类型契约 | `packages/shared/src/platform/types.ts`（`WsMessage`） |

## 连接与鉴权

```text
ws://host/api/ws?token={accessToken}
```

- token 无效 / 缺失 → 服务端以 **close code 4001**（`Unauthorized`）关闭
- token 的 `jti` 在 Redis 黑名单中（已被强制下线）→ 4001（`Session revoked`）；Redis 故障时放行（fail-open）
- 连接按 `jti`（tokenId）注册：同一用户多端登录持有多个连接，`sendToUser` 会推给该用户全部连接，`sendToToken` 精准推给单个会话

### 心跳

客户端定期发送 `{"type":"ping"}`，服务端立即回 `{"type":"pong"}`，维持代理链路上的连接活性。

### 在线状态（presence）

用户从 0 → 1 个连接时全员广播 `chat:presence`（online: true）；最后一个连接断开时广播 offline 并记录 `lastSeen`。服务端另提供 `isUserOnline` / `getOnlineUserIds` / `getUserLastSeen` 查询。

## 服务端发送 API

```ts
import { sendToUser, sendToToken, broadcast, scheduleSendToUsers } from '../lib/ws-manager';

sendToUser(userId, { type: 'in-app-message:new', payload: msg });  // 用户全部会话
sendToToken(tokenId, { type: 'session:force-logout', payload: { reason } }); // 单个会话
broadcast({ type: 'announcement:new', payload: ann });             // 全员
scheduleSendToUsers(members, msg);  // 延迟到下一个 I/O tick，让 HTTP 响应先落盘
closeTokenConnection(tokenId);       // 强制下线单会话
closeUserConnections(userId);        // 强制下线用户全部会话
```

连接指标（当前连接数、累计收发、最近断连原因）通过 `getWsSnapshot()` 暴露给监控页面。

## 事件清单

以下事件均在 `WsMessage` 类型中定义，并与服务端实际 emit 点核对一致。

### 公告与站内信（`services/messaging`）

| 事件 | 时机 |
| --- | --- |
| `announcement:new` / `announcement:updated` / `announcement:deleted` | 公告发布 / 更新 / 删除（广播） |
| `announcement:read` / `announcement:read-all` | 当前用户已读回执（多端同步未读数） |
| `in-app-message:new` | 新站内信（工作流评论 @ 提醒也走此事件） |
| `in-app-message:read` / `read-all` / `deleted` | 已读 / 全部已读 / 删除（多端同步） |

### 会话管理

| 事件 | 时机 |
| --- | --- |
| `session:force-logout` | 管理员强制下线该会话，前端收到后清理本地状态并跳登录页 |

### 聊天（`services/chat`）

| 事件 | 时机 |
| --- | --- |
| `chat:message` | 新消息（含机器人回复、通话记录系统消息） |
| `chat:recall` / `chat:edit` | 撤回 / 编辑 |
| `chat:read` | 会话已读回执 |
| `chat:typing` | 正在输入（客户端发送，服务端转发给会话内其他成员，不落库） |
| `chat:reaction` / `chat:vote-update` | 表情回应 / 投票更新 |
| `chat:member-join` / `chat:member-leave` / `chat:member-update` | 群成员加入 / 退出 / 变更（含邀请链接入群） |
| `chat:group-update` | 群信息变更（名称、群公告、全员禁言） |
| `chat:presence` | 用户上下线 |

### 频道（`services/messaging/channel*`）

| 事件 | 时机 |
| --- | --- |
| `channel:message` | 频道新消息（含客服双向消息） |
| `channel:message-retract` | 频道消息撤回 |
| `channel:cs-message` | 频道客服会话有新动态（通知刷新） |

### 音视频通话信令（rtc）

客户端之间通过 WebSocket 中继信令（详见 [WebRTC 通话](./webrtc-calls.md)）：

| 事件 | 说明 |
| --- | --- |
| `rtc:invite` / `rtc:accept` / `rtc:reject` / `rtc:busy` / `rtc:cancel` | 呼叫生命周期 |
| `rtc:join` / `rtc:room-participants` / `rtc:leave` | 群通话进出房（`room-participants` 由服务端回送给加入者） |
| `rtc:offer` / `rtc:answer` / `rtc:ice` | SDP / ICE 交换 |

中继规则（`routes/platform/ws.ts`）：payload 带 `to` → 定向转发；否则按 `conversationId` 转发给会话内其他成员（成员列表走短 TTL 缓存）。用户断线时服务端自动 `leaveAllRooms` 并向房间剩余成员补发 `rtc:leave`。

### 工作流（`lib/workflow-subscribers/ws.ts`）

| 事件 | 时机 |
| --- | --- |
| `workflow:taskCreated` | 新审批任务到达（推给处理人） |
| `workflow:taskFinished` | 任务完成（decision：`approved` / `rejected` / `skipped`） |
| `workflow:instanceFinished` | 流程实例结束（推给发起人） |

### 支付（`services/payment/payment-subscribers.ts`）

| 事件 | 时机 |
| --- | --- |
| `payment:success` / `payment:closed` / `payment:failed` | 订单支付成功 / 关闭 / 失败 |
| `payment:refunded` / `payment:refund-failed` | 退款成功 / 失败 |

### 任务中心（`lib/task-center`）

| 事件 | 时机 |
| --- | --- |
| `task:progress` | 异步任务进度（推给任务创建者，300ms 节流；终态与状态变更立即推送，payload 为完整 `AsyncTask`） |

### 公众号客服（`services/mp/mp-kf-session.service.ts`）

| 事件 | 时机 |
| --- | --- |
| `mp-kf:session-new` | 新客服会话进线 |
| `mp-kf:session-update` | 会话状态变更（认领、转接、关闭、超时） |
| `mp-kf:session-message` | 会话新消息（含访客与客服双向） |

### 数据分析（`services/analytics`）

| 事件 | 时机 |
| --- | --- |
| `analytics:ingest` | 埋点事件入库（实时大屏刷新用，payload 为本批 count） |
| `analytics:config-updated` | 采集配置变更（通知 SDK 配置下发） |

## Web 终端与终端监控

运维中心的 Web 终端使用**独立的 WebSocket 端点**（不走 `/api/ws`，也不属于 `WsMessage` 契约）：

- `/api/ws/terminal` — 终端会话：`terminal:output`、`terminal:cwd`、`terminal:error`、`terminal:exit`、`terminal:reconnected`、`terminal:ended`、`terminal:terminated`
- `/api/ws/terminal-monitor` — 管理员旁路监控：`monitor:attached`、`monitor:not-found`

## 新增事件的步骤

1. 在 `packages/shared/src/platform/types.ts` 的 `WsMessage` 联合类型中登记事件名与 payload 结构
2. 服务端在业务 service 中调用 `sendToUser` / `broadcast`（列表通知优先 `scheduleSendToUsers`）
3. 前端在 WebSocket hook 中按 `type` 分发处理（通常配合 TanStack Query 失效对应缓存）
