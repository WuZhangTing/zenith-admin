/**
 * 应用主日志：原生 pino 实例（NDJSON 结构化输出）。
 *
 * 输出（worker 线程 transport，序列化之外的开销不占主线程）：
 *  - 文件：pino-roll 按天轮转 `logs/app.YYYY-MM-DD.N.log`，保留 LOG_MAX_FILES 份，NDJSON
 *  - 控制台：默认输出 NDJSON 到 stdout（交给容器日志采集）；
 *    LOG_CONSOLE_PRETTY=true 时经 pino-pretty 彩色单行输出（本地开发用）
 *
 * 调用约定（`hooks.logMethod` 归一化，两种写法都支持）：
 *  - pino 原生：`logger.info({ userId }, '登录成功')`，新代码优先用这种
 *  - 消息在前：`logger.info('登录成功', meta)` —— meta 为 Error 记入 `err`（带堆栈），
 *    普通对象作为结构化字段合并，其余类型记入 `meta` 字段
 *  - 请求级子 logger：`logger.child({ requestId })` 原生可用
 *
 * warn / error / fatal 在 logMethod hook 写入点计入 log-metrics 计数器
 * （监控告警的 logErrorPerMin / logWarnPerMin；hook 仅在级别启用时触发）。
 */
import path from 'node:path';
import { pino, destination, levels, stdSerializers, stdTimeFunctions, type Logger, type LogFn, type TransportTargetOptions } from 'pino';
import { config } from '../config';
import { recordLogLevel } from './log-metrics';

/**
 * 级别方法同时接受两种写法（由 logMethod hook 归一化）：
 *  - pino 原生：`(mergingObject, message?)`
 *  - 消息在前：`(message, meta?)`（meta 只允许一个；多参 printf 请用原生写法）
 */
interface AppLogFn {
  <T extends object>(obj: T, msg?: string, ...args: unknown[]): void;
  (msg: string, meta?: unknown): void;
  (obj: unknown, msg?: string): void;
}
type LevelMethod = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
/** 原生 pino Logger，级别方法放宽为双写法签名；child() 返回原生严格签名的 Logger */
export type AppLogger = Omit<Logger, LevelMethod> & Record<LevelMethod, AppLogFn>;

const WARN = levels.values.warn;
const ERROR = levels.values.error;

/** 消息含 printf 插值符时走 pino 原生插值，不做参数归一 */
const PRINTF_TOKEN_RE = /%[sdjoO]/;

/**
 * logMethod hook：
 * 1. warn 及以上写入点计数（fatal 归入 error 桶）
 * 2. 将「消息在前」的两参调用翻转为 pino 原生的 `(mergingObject, message)`
 *    （官方文档 hooks.logMethod 示例即参数翻转用法）
 */
function logMethod(this: Logger, args: Parameters<LogFn>, method: LogFn, level: number): void {
  if (level >= ERROR) recordLogLevel('error');
  else if (level >= WARN) recordLogLevel('warn');

  const [first, second, ...rest] = args as unknown[];
  if (typeof first === 'string' && second !== undefined && rest.length === 0 && !PRINTF_TOKEN_RE.test(first)) {
    const merge = second instanceof Error
      ? { err: second }
      : typeof second === 'object' && second !== null
        ? second
        : { meta: second };
    (method as (obj: object, msg: string) => void).call(this, merge, first);
    return;
  }
  method.apply(this, args);
}

const fileTarget: TransportTargetOptions = {
  target: 'pino-roll',
  // targets 多目标模式下 per-target level 缺省是 'info'（api.md），
  // 必须显式跟随 logger 级别，否则 LOG_LEVEL=debug/trace 的日志到不了输出
  level: config.log.level,
  options: {
    file: path.join(config.log.dir, 'app'),
    frequency: 'daily',
    dateFormat: 'yyyy-MM-dd',
    extension: '.log',
    mkdir: true,
    limit: { count: config.log.maxFiles, removeOtherLogFiles: true },
  },
};

const consoleTarget: TransportTargetOptions = config.log.pretty
  ? {
      target: 'pino-pretty',
      level: config.log.level,
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: true,
      },
    }
  : { target: 'pino/file', level: config.log.level, options: { destination: 1 } };

/**
 * 测试进程（vitest）直写 stdout，不启用 worker transport：
 * 每个测试进程各起 worker 线程并发写同一日志文件既无意义，
 * 又会在进程 teardown 时产生 thread-stream 竞态导致偶发 unhandled error。
 */
const options = {
  level: config.log.level,
  timestamp: stdTimeFunctions.isoTime,
  // 级别保持 pino 默认的数字形式（10-60，行首第一个键），日志查看器与采集端按数字映射
  serializers: { err: stdSerializers.err, error: stdSerializers.err },
  hooks: { logMethod },
} satisfies Parameters<typeof pino>[0];

const logger = (process.env.VITEST
  ? pino(options, destination({ dest: 1, sync: true }))
  : pino({ ...options, transport: { targets: [fileTarget, consoleTarget] } })
) as unknown as AppLogger;

export default logger;
