/**
 * 应用主日志（pino）：彩色控制台输出 + 按天轮转的本地文件（pretty 单行文本，不压缩）。
 *
 * 门面签名 `logger.info(message, meta?)`，调用点无需感知 pino 的参数约定：
 *  - meta 为 Error 时记入 `err` 字段（经 std serializer 带堆栈输出）
 *  - meta 为普通对象时作为结构化字段合并
 *  - 其他类型记入 `meta` 字段
 *
 * warn / error 写入点同步计入 log-metrics 计数器
 * （监控告警的 logErrorPerMin / logWarnPerMin）。
 */
import path from 'node:path';
import { pino, multistream, stdSerializers, type Level, type StreamEntry } from 'pino';
import pretty from 'pino-pretty';
import pinoRoll from 'pino-roll';
import { config } from '../config';
import { recordLogLevel } from './log-metrics';

/** LOG_LEVEL 常见别名到 pino 级别的容错映射 */
const LEVEL_ALIASES: Record<string, Level> = {
  http: 'debug',
  verbose: 'debug',
  silly: 'trace',
};
const PINO_LEVELS = new Set<string>(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);

function resolveLevel(raw: string): Level {
  const lower = raw.toLowerCase();
  if (PINO_LEVELS.has(lower)) return lower as Level;
  return LEVEL_ALIASES[lower] ?? 'info';
}

/** 取 LOG_MAX_FILES 的前导数字作为轮转文件保留份数（'30' 与 '30d' 均解析为 30） */
export function resolveLogMaxFiles(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

const level = resolveLevel(config.log.level);

/** 控制台与文件共用的 pretty 选项：本地时间戳 + 单行输出（便于 tail / grep / ops 日志查看器） */
const PRETTY_BASE = {
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
  ignore: 'pid,hostname',
  singleLine: true,
} as const;

/** 按天轮转的应用日志文件：logs/app.YYYY-MM-DD.N.log，保留份数按 LOG_MAX_FILES */
const fileDestination = await pinoRoll({
  file: path.join(config.log.dir, 'app'),
  frequency: 'daily',
  dateFormat: 'yyyy-MM-dd',
  extension: '.log',
  mkdir: true,
  limit: { count: resolveLogMaxFiles(config.log.maxFiles), removeOtherLogFiles: true },
});

const streams: StreamEntry[] = [
  { level, stream: pretty({ ...PRETTY_BASE, colorize: true, sync: true }) },
  { level, stream: pretty({ ...PRETTY_BASE, colorize: false, destination: fileDestination }) },
];

const pinoLogger = pino(
  {
    level,
    base: undefined,
    serializers: { err: stdSerializers.err, error: stdSerializers.err },
  },
  multistream(streams),
);

type FacadeLevel = 'error' | 'warn' | 'info' | 'debug';

/** 将门面 meta 参数转换为 pino 的合并对象 */
function toMergeObject(meta: unknown): object {
  if (meta instanceof Error) return { err: meta };
  if (typeof meta === 'object' && meta !== null) return meta;
  return { meta };
}

function dispatch(levelName: FacadeLevel, message: unknown, meta?: unknown): void {
  if ((levelName === 'error' || levelName === 'warn') && pinoLogger.isLevelEnabled(levelName)) {
    recordLogLevel(levelName);
  }
  if (meta === undefined) {
    pinoLogger[levelName](message); // 字符串走 msg，Error / 对象由 pino 序列化
    return;
  }
  pinoLogger[levelName](toMergeObject(meta), typeof message === 'string' ? message : String(message));
}

const logger = {
  error: (message: unknown, meta?: unknown): void => dispatch('error', message, meta),
  warn: (message: unknown, meta?: unknown): void => dispatch('warn', message, meta),
  info: (message: unknown, meta?: unknown): void => dispatch('info', message, meta),
  debug: (message: unknown, meta?: unknown): void => dispatch('debug', message, meta),
};

export default logger;
