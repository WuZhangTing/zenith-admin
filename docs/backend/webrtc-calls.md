# WebRTC 音视频通话

聊天模块内置一对一与群组音视频通话。媒体流走浏览器间 P2P（WebRTC），服务端只承担两件事：**信令中继**（复用 `/api/ws` WebSocket）与 **ICE 配置下发**——不经手任何音视频数据。

代码位置速查：

| 模块 | 位置 |
| --- | --- |
| 信令中继 | `packages/server/src/routes/platform/ws.ts` |
| 群通话房间（内存） | `packages/server/src/lib/rtc-manager.ts` |
| ICE 配置 / 通话记录 | `packages/server/src/services/chat/chat-rtc.service.ts` |
| 前端通话状态机 | `packages/web/src/webrtc/callManager.ts` |
| 通话 UI | `packages/web/src/webrtc/CallWindow.tsx` 等 |

## 服务端

### ICE 配置下发

```text
GET /api/chat/rtc/config
```

返回 `{ iceServers: [...] }`，由环境变量组装：

```dotenv
WEBRTC_STUN_URLS=stun:stun.l.google.com:19302   # 逗号分隔，默认 Google 公共 STUN
WEBRTC_TURN_URLS=                                # TURN 服务器（可选，逗号分隔）
WEBRTC_TURN_USERNAME=
WEBRTC_TURN_CREDENTIAL=
```

::: tip 生产建议
公网 NAT 穿透成功率有限，生产环境建议自建 TURN（如 coturn）保证连通性；仅内网使用时可不配 TURN。
:::

### 信令中继

所有 `rtc:*` 事件经 WebSocket 转发（事件清单见 [WebSocket 事件](./websocket-events.md#音视频通话信令-rtc)）。转发规则：

- payload 带 `to` → 定向发给目标用户
- 否则按 `conversationId` 发给会话内其他成员
- `rtc:join` 特殊处理：服务端把加入者登记进房间（`rtc-manager`），并回送 `rtc:room-participants`（当前已在房内的成员列表），加入者据此逐个建连

### 群通话房间

`rtc-manager.ts` 维护 `callId → 成员` 的内存映射：

- 用途仅两个：告知新成员现有参与者（发起 mesh 建连）、断线时自动 `leaveAllRooms` 并向剩余成员补发 `rtc:leave`
- 单进程内存方案，多实例部署需改造为共享存储（与 ws-manager 同等约束）

### 通话记录

通话结束后由客户端上报，作为**系统消息**写入会话消息流：

```text
POST /api/chat/conversations/{id}/call-record
```

body 按 `chatCallRecordSchema`（`@zenith/shared/chat`）：通话类型（音频/视频）、状态（completed / missed / rejected / cancelled）、时长。服务端格式化为「语音通话结束 · 时长 xx:xx」等文案并广播 `chat:message`。

## 前端通话流程

`callManager.ts` 是单例状态机，UI 通过快照订阅渲染。

### 一对一呼叫

```text
主叫                                被叫
 │ rtc:invite ──────────────────────▶ 弹接听框
 │        （35s 无应答自动取消，cleanup('timeout')）
 │ ◀────────────────── rtc:accept / rtc:reject / rtc:busy
 │ rtc:offer ───────────────────────▶
 │ ◀─────────────────────── rtc:answer
 │ rtc:ice ◀───────────────────────▶ （双向持续交换）
 │ 媒体流 P2P 直连
 │ rtc:cancel / rtc:leave ──────────▶ 任一方挂断
```

- **响铃超时**：`RING_TIMEOUT_MS = 35_000`，超时主叫自动取消
- **忙线**：被叫已在通话中（P2P 模式）自动回 `rtc:busy`
- 挂断 / 拒绝 / 忙线均触发本地 `cleanup` 并写通话记录

### 群通话（mesh）

- 每个参与者与其他所有人两两建连（适合小规模，无 SFU）
- 加入者收到 `rtc:room-participants` 后向现有成员逐个发 offer
- 信令冲突用 **perfect negotiation** 处理：按 `userId` 大小分配 polite / impolite 角色，`makingOffer` / `ignoreOffer` 标志避免 glare

### 通话中能力

- 静音 / 关摄像头（track enabled 切换）
- **屏幕共享**：`getDisplayMedia` 获取屏幕轨，`replaceTrack` 替换视频发送轨，结束后切回摄像头
- 通话窗口悬浮可拖拽

## 排障

| 现象 | 排查 |
| --- | --- |
| 呼不通（对方无弹窗） | WebSocket 是否连接、对方是否在线（`chat:presence`） |
| 一直连接中 / 单向音频 | NAT 穿透失败——检查 `GET /api/chat/rtc/config` 返回、TURN 配置与可达性 |
| localhost 可用、局域网不可用 | 浏览器要求 HTTPS（或 localhost）才允许 `getUserMedia` |
| 断线后对方界面残留 | 服务端已在 WS 断连时补发 `rtc:leave`；检查前端是否处理该事件 |
