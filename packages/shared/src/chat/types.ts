import type { RtcCallMode, RtcCallType } from './constants';

export interface ExportColumnMeta {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'datetime' | 'date' | 'enum' | 'money' | 'boolean';
  sensitive?: boolean;
  children?: ExportColumnMeta[];
}

export type SystemSchedulerAlertChannel = 'inapp' | 'email' | 'webhook';

// ─── WebRTC 信令（WebSocket 载荷，不经 HTTP 契约） ────────────────────────────

/** 通话参与者基本信息 */
export interface RtcPeerInfo {
  userId: number;
  nickname: string;
  avatar: string | null;
}

/** 与 RTCIceCandidateInit 对齐的可序列化 ICE candidate（避免 DOM 类型依赖） */
export interface RtcIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface RtcInvitePayload {
  callId: string;
  conversationId: number;
  callType: RtcCallType;
  mode: RtcCallMode;
  from: RtcPeerInfo;
  /** 单聊定向邀请的目标用户；群聊为空（广播给会话成员） */
  to?: number;
  /** 会话展示名（来电界面用） */
  conversationName?: string | null;
}
