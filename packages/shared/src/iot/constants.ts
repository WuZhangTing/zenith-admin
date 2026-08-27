import { createLabelOptions } from '../core/enum-options';

// ─── 指令状态 ─────────────────────────────────────────────────────────────────
export const IOT_COMMAND_STATUSES = ['pending', 'delivered', 'acked', 'failed', 'expired'] as const;

export type IotCommandStatus = (typeof IOT_COMMAND_STATUSES)[number];

export const IOT_COMMAND_STATUS_LABELS: Record<IotCommandStatus, string> = {
  pending: '待下发',
  delivered: '已送达',
  acked: '执行成功',
  failed: '执行失败',
  expired: '已超时',
};

export const IOT_COMMAND_STATUS_OPTIONS = createLabelOptions(IOT_COMMAND_STATUSES, IOT_COMMAND_STATUS_LABELS);

// ─── 设备接入协议 ─────────────────────────────────────────────────────────────
/** 设备上报/WS 握手签名头（HMAC-SHA256(secret, `${sn}\n${ts}\n${body}`) 的 hex） */
export const IOT_SIGN_HEADER = 'X-IoT-Sign';

export const IOT_SN_HEADER = 'X-IoT-Sn';

export const IOT_TIMESTAMP_HEADER = 'X-IoT-Timestamp';

/** 签名时间窗（秒）：超过视为重放/时钟漂移，拒绝 */
export const IOT_SIGN_MAX_SKEW_SECONDS = 300;

/** 心跳在线 TTL（秒）：Redis 键存活即在线；设备建议 30s 心跳一次 */
export const IOT_ONLINE_TTL_SECONDS = 90;

/** 指令默认超时（秒） */
export const IOT_COMMAND_DEFAULT_TTL_SECONDS = 300;

/** 单次批量遥测上报最大条数 */
export const IOT_TELEMETRY_BATCH_MAX = 100;

// ─── WS 帧类型（设备网关双向协议）────────────────────────────────────────────
export const IOT_WS_FRAME_TYPES = {
  /** 设备 → 服务端 */
  heartbeat: 'heartbeat',
  telemetry: 'telemetry',
  commandAck: 'command:ack',
  /** 服务端 → 设备 */
  commandExec: 'command:exec',
  heartbeatAck: 'heartbeat:ack',
} as const;
