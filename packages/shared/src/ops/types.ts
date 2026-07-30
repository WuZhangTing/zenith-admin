/** Terminal WebSocket 消息（独立端点 /api/ws/terminal） */
export type TerminalMessage =
  | { type: 'terminal:input'; data: string }
  | { type: 'terminal:output'; data: string }
  | { type: 'terminal:cwd'; cwd: string }
  | { type: 'terminal:resize'; cols: number; rows: number }
  | { type: 'terminal:close' }
  | { type: 'terminal:exit' }
  | { type: 'terminal:error'; message: string };

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
