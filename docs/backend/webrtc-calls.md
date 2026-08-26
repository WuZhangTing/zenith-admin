# WebRTC 音视频通话

WebRTC 通话能力由聊天域提供。服务端只处理信令中继、房间参与者状态和通话记录，不处理媒体流。

## 主要文件

| 文件 | 说明 |
| --- | --- |
| `packages/server/src/lib/rtc-manager.ts` | WebRTC 房间与信令转发 |
| `packages/server/src/lib/ws-manager.ts` | WebSocket 用户连接管理 |
| `packages/server/src/routes/chat/chat.ts` | ICE 配置与通话记录 API |
| `packages/server/src/services/chat/chat-rtc.service.ts` | 通话记录写入 |
| `packages/shared/src/chat/validation.ts` | 通话记录校验 |

## 信令事件

WebSocket 使用 `rtc:*` 类型传递信令：

- `rtc:invite`
- `rtc:accept`
- `rtc:reject`
- `rtc:busy`
- `rtc:cancel`
- `rtc:join`
- `rtc:room-participants`
- `rtc:leave`
- `rtc:offer`
- `rtc:answer`
- `rtc:ice`

`rtc:join` 会进入房间管理分支，服务端维护内存房间成员并向参与者广播 `rtc:room-participants`。断开连接时，服务端会清理参与房间并发送 `rtc:leave`。

## ICE 配置

接口：

```text
GET /api/chat/rtc/config
```

该接口需要管理端鉴权，返回浏览器 `RTCPeerConnection` 可用的 ICE server 配置。

## 通话记录

接口：

```text
POST /api/chat/conversations/{id}/call-record
```

通话记录状态来自共享 schema：

- `completed`
- `missed`
- `canceled`
- `rejected`

记录写入由 `chat-rtc.service.ts` 完成，归属到聊天会话。

## 服务端边界

- 服务端不存储音视频媒体内容。
- TURN / STUN 可达性由 ICE 配置和部署环境保证。
- 房间成员状态保存在进程内存；多实例部署需要保证同一房间信令落到同一进程，或引入跨节点信令同步能力。
- 通话记录是业务审计与会话摘要，不代表媒体连接一定成功。
