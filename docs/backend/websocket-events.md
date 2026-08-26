# WebSocket 事件清单

管理端实时通道入口为 `/api/ws?token={accessToken}`。消息契约以 `packages/shared/src/platform/types.ts` 中的 `WsMessage` 为准，服务端管理器位于 `packages/server/src/lib/ws-manager.ts`。

## 连接认证

客户端通过查询参数传入管理端 access token：

```text
/api/ws?token=eyJ...
```

认证失败关闭连接：

- 无效 token：`4001 Unauthorized`
- 会话被撤销或 JWT 黑名单命中：`4001 Session revoked`

Redis 检查异常时 fail-open。连接成功后按用户维度建立连接集合，用于单用户、多用户和广播推送。

## 事件类型

| 类型 | payload | 说明 |
| --- | --- | --- |
| `announcement:new` | `AnnouncementDTO` | 新公告 |
| `announcement:updated` | `AnnouncementDTO` | 公告更新 |
| `announcement:deleted` | `{ id: number }` | 公告删除 |
| `announcement:read` | `{ id: number }` | 公告已读 |
| `announcement:read-all` | `{}` | 公告全部已读 |
| `in-app-message:new` | `InAppMessageDTO` | 新站内信 |
| `in-app-message:read` | `{ id: number }` | 站内信已读 |
| `in-app-message:read-all` | `{}` | 站内信全部已读 |
| `in-app-message:deleted` | `{ id: number }` | 站内信删除 |
| `session:force-logout` | `{ reason?: string }` | 强制下线 |
| `chat:message` | `unknown` | 聊天消息 |
| `chat:recall` | `{ messageId: number; conversationId: number }` | 撤回消息 |
| `chat:read` | `{ conversationId: number; userId: number }` | 会话已读 |
| `chat:member-join` | `{ conversationId: number; userId: number }` | 成员加入 |
| `chat:member-leave` | `{ conversationId: number; userId: number }` | 成员离开 |
| `chat:group-update` | `{ conversationId: number }` | 群信息更新 |
| `chat:member-update` | `{ conversationId: number }` | 群成员更新 |
| `chat:join-request` | `unknown` | 入群申请 |
| `chat:conversation-removed` | `{ conversationId: number }` | 会话被移除 |
| `chat:typing` | `{ conversationId: number; userId: number; typing: boolean }` | 输入状态 |
| `chat:reaction` | `unknown` | 表情回应 |
| `chat:edit` | `unknown` | 编辑消息 |
| `chat:vote-update` | `unknown` | 投票更新 |
| `chat:presence` | `unknown` | 在线状态 |
| `channel:message` | `unknown` | 频道消息 |
| `channel:message-retract` | `unknown` | 频道消息撤回 |
| `channel:cs-message` | `unknown` | 客服消息 |
| `rtc:invite` | `unknown` | 音视频邀请 |
| `rtc:accept` | `unknown` | 接听 |
| `rtc:reject` | `unknown` | 拒绝 |
| `rtc:busy` | `unknown` | 忙线 |
| `rtc:cancel` | `unknown` | 取消 |
| `rtc:join` | `unknown` | 加入通话房间 |
| `rtc:room-participants` | `unknown` | 房间成员列表 |
| `rtc:leave` | `unknown` | 离开通话 |
| `rtc:offer` | `unknown` | WebRTC offer |
| `rtc:answer` | `unknown` | WebRTC answer |
| `rtc:ice` | `unknown` | ICE candidate |
| `workflow:taskCreated` | `unknown` | 工作流待办创建 |
| `workflow:taskFinished` | `unknown` | 工作流任务完成 |
| `workflow:instanceFinished` | `unknown` | 流程实例完成 |
| `payment:success` | `unknown` | 支付成功 |
| `payment:closed` | `unknown` | 支付关闭 |
| `payment:failed` | `unknown` | 支付失败 |
| `payment:refunded` | `unknown` | 退款成功 |
| `payment:refund-failed` | `unknown` | 退款失败 |
| `task:progress` | `unknown` | 任务进度 |
| `mp-kf:session-new` | `unknown` | 公众号客服新会话 |
| `mp-kf:session-update` | `unknown` | 公众号客服会话更新 |
| `mp-kf:session-message` | `unknown` | 公众号客服消息 |
| `analytics:ingest` | `unknown` | 埋点摄取通知 |
| `analytics:config-updated` | `unknown` | 埋点配置更新 |

## WebRTC 信令

`rtc:*` 事件由 `rtc-manager.ts` 和聊天路由协作。`rtc:join` 在服务端有单独分支，会维护房间成员并下发 `rtc:room-participants`；其他信令按目标用户或房间转发。

## 独立 WebSocket 端点

以下端点是专用协议，不属于 `WsMessage` 清单：

- `/api/ws/terminal`
- `/api/ws/terminal-monitor`

## 客户端处理建议

- 使用 `type` 做分发，payload 按事件类型收窄。
- 未识别事件应忽略并保留日志，避免客户端因服务端扩展中断。
- 断线后重新拉取公告、站内信、聊天会话等可缓存状态，WebSocket 只作为实时增量通知。
