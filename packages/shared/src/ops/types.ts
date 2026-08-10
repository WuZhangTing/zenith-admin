/** Terminal WebSocket 消息（独立端点 /api/ws/terminal） */
export type TerminalMessage =
  | { type: 'terminal:input'; data: string }
  | { type: 'terminal:output'; data: string }
  | { type: 'terminal:cwd'; cwd: string }
  | { type: 'terminal:resize'; cols: number; rows: number }
  | { type: 'terminal:close' }
  | { type: 'terminal:exit' }
  | { type: 'terminal:error'; message: string }
  /** 服务端下发本次会话的权威标识；客户端保存后用于断线重连 */
  | { type: 'terminal:session'; sessionId: string }
  /** 重连成功，后续按输出缓冲回放 */
  | { type: 'terminal:reconnected' };

// ─── 进程管理 ───────────────────────────────────────────────────────────────
export interface ProcessNetConn {
  localAddr: string;
  localPort: number;
  remoteAddr: string;
  remotePort: number;
  state: string;
  protocol: string; // 'tcp' | 'udp'
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  /** 'running' | 'sleeping' | 'disk-sleep' | 'stopped' | 'zombie' | 'idle' | 'unknown' */
  status: string;
  /** CPU usage percentage (instantaneous on Linux/macOS; cumulative seconds on Windows) */
  cpu: number;
  /** RSS memory in bytes */
  memory: number;
  /** Memory usage percentage */
  memoryPercent: number;
  startTime: string | null;
  /** Full command line or process name */
  command: string;
  user: string;
  threads: number;
  /** Nice value -20~19 (Linux/macOS), null on Windows */
  nice: number | null;
  /** Windows priority class, null on Unix */
  priorityClass: string | null;
  /** Listening port numbers (comma-separated string, from cached netstat) */
  ports: string | null;
  /** Full connection list (only populated in detail view) */
  connections: ProcessNetConn[] | null;
  /** Working directory (Linux only, detail view, may be null if no permission) */
  cwd?: string | null;
  /** Environment variables (Linux only, detail view, may be null if no permission) */
  env?: Record<string, string> | null;
}

export interface ProcessListResponse {
  /** OS platform: 'linux' | 'darwin' | 'win32' */
  platform: string;
  processes: ProcessInfo[];
  total: number;
  timestamp: string;
}

// ─── SQL 收藏夹 ──────────────────────────────────────────────────────────────
export interface DbQueryFavorite {
  id: number;
  name: string;
  sql: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SslCertificate {
  id: number;
  name: string;
  domain: string;
  type: 'self_signed' | 'uploaded' | 'letsencrypt';
  certPath: string | null;
  keyPath: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  fingerprint: string | null;
  serialNumber: string | null;
  status: 'valid' | 'expiring' | 'expired' | 'invalid';
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 数据保留策略 ────────────────────────────────────────────────────────────
/**
 * 清理模式：
 * - `age`       按时间列裁剪超期行
 * - `ageAndCap` 在 `age` 之上，再按分组保留最近 N 行
 * - `expiresAt` 按行内到期列裁剪（到期时间在写入时确定）
 */
export type RetentionMode = 'age' | 'ageAndCap' | 'expiresAt';

export interface RetentionPolicy {
  /** 策略唯一键，等于目标物理表名 */
  key: string;
  title: string;
  module: string;
  /** 目标物理表名 */
  tableName: string;
  /** 裁剪依据的时间列（物理列名） */
  timeColumn: string;
  mode: RetentionMode;
  enabled: boolean;
  /** 保留天数；0 表示不清理 */
  retentionDays: number;
  /** 代码声明的默认保留天数，用于「恢复默认」 */
  defaultRetentionDays: number;
  batchSize: number;
  /** 是否按租户各自的保留策略执行 */
  perTenant: boolean;
  /** `ageAndCap` 模式下的分组列与保留条数 */
  capColumn: string | null;
  capLimit: number | null;
  description: string;
  lastRunAt: string | null;
  lastDeleted: number;
}

export interface RetentionPreview {
  key: string;
  /** 预计待删除行数 */
  pending: number;
  /** 裁剪时间点；`0 天 = 不清理` 时为 null */
  cutoff: string | null;
}

export interface RetentionRunResult {
  key: string;
  title: string;
  deleted: number;
}

