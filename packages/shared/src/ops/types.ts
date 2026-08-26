import type {
  AppArch,
  AppArtifactKind,
  AppPlatform,
  AppReleaseChannel,
  AppReleaseStatus,
} from './constants';

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
 * - `expiresAt` 按行内到期列裁剪（保留天数 = 到期后的宽限天数）
 * - `custom`    删除逻辑委托给领域函数（跨表条件、文件副作用等），天数仍由本策略配置
 */
export type RetentionMode = 'age' | 'ageAndCap' | 'expiresAt' | 'custom';

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

// ─── 应用版本管理（在线升级）──────────────────────────────────────────────────

export interface ClientApp {
  id: number;
  appKey: string;
  name: string;
  description?: string | null;
  status: 'enabled' | 'disabled';
  /** 列表冗余：版本总数与最新已发布版本号 */
  releaseCount?: number;
  latestVersion?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppArtifact {
  id: number;
  releaseId: number;
  platform: AppPlatform;
  arch: AppArch;
  kind: AppArtifactKind;
  fileId?: string | null;
  externalUrl?: string | null;
  fileName: string;
  size: number;
  sha256?: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppRelease {
  id: number;
  appId: number;
  /** JOIN 冗余，供列表直接展示 */
  appKey?: string;
  appName?: string;
  channel: AppReleaseChannel;
  version: string;
  notes?: string | null;
  status: AppReleaseStatus;
  mandatory: boolean;
  minVersion?: string | null;
  rolloutPercent: number;
  publishedAt?: string | null;
  artifactCount?: number;
  artifacts?: AppArtifact[];
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 公开 check API 的响应（对外裁剪，不含内部字段） */
export interface AppUpdateCheckResult {
  hasUpdate: boolean;
  /** hasUpdate=true 时以下字段存在 */
  mandatory?: boolean;
  version?: string;
  notes?: string | null;
  publishedAt?: string | null;
  artifact?: {
    kind: AppArtifactKind;
    fileName: string;
    size: number;
    sha256?: string | null;
    /** 托管制品为服务端下载地址；external 制品为外部跳转链接 */
    downloadUrl: string;
  };
}

/** 公开 latest API 的响应（官网下载页用） */export interface AppPublicReleaseInfo {
  version: string;
  notes?: string | null;
  publishedAt?: string | null;
  artifacts: Array<{
    platform: AppPlatform;
    arch: AppArch;
    kind: AppArtifactKind;
    fileName: string;
    size: number;
    sha256?: string | null;
    downloadUrl: string;
  }>;
}

/** 升级看板统计 */
export interface AppReleaseStats {
  totals: {
    checks: number;
    downloads: number;
    devices: number;
    installSuccess: number;
    installFail: number;
  };
  trend: Array<{
    date: string;
    checks: number;
    downloads: number;
    installSuccess: number;
    installFail: number;
  }>;
  platforms: Array<{ platform: AppPlatform; count: number }>;
  /** 活跃设备的客户端版本分布（直查统一设备中心） */
  versions: Array<{ version: string; devices: number }>;
}

// ─── 统一设备中心 ─────────────────────────────────────────────────────────────

/** 设备绑定人类型（与通知收件人 user/member 对齐） */
export const DEVICE_SUBJECT_TYPES = ['user', 'member'] as const;
export type DeviceSubjectType = (typeof DEVICE_SUBJECT_TYPES)[number];

export interface ClientDevice {
  id: number;
  deviceId: string;
  appId: number;
  /** JOIN 冗余 */
  appName?: string;
  platform: AppPlatform;
  arch?: AppArch | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  subjectType?: DeviceSubjectType | null;
  subjectId?: number | null;
  /** JOIN 冗余:绑定人显示名 */
  subjectName?: string | null;
  pushProvider?: string | null;
  pushRegistrationId?: string | null;
  pushEnabled: boolean;
  createdAt: string;
  lastActiveAt: string;
}

