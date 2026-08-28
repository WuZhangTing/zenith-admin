/**
 * 日志级别计数指标源：在 logger 的 logMethod hook 写入点计数，供监控告警评估器取数。
 *
 * 不扫描日志文件——零 I/O、零解析，也不用管轮转与归档；
 * 与 metricsSampler 的 qps / errorRate 同属进程内口径。
 * 补足 `errorRate`（仅 HTTP 5xx）的盲区：后台任务、事件订阅者、启动期错误只出现在日志里。
 *
 * 注意：本文件不得引入 logger（logger 写入点调用本模块，反向引用会成环）。
 */

/** 滚动窗口长度（分钟）：告警评估器每 30s 取一次「近 N 分钟平均每分钟条数」 */
const WINDOW_MINUTES = 5;

type CountedLevel = 'error' | 'warn';

/** 按 epoch 分钟分桶的滚动计数器；读写时惰性淘汰窗口外的桶 */
class LogLevelCounter {
  private readonly buckets = new Map<number, Record<CountedLevel, number>>();

  private prune(nowMinute: number): void {
    for (const key of this.buckets.keys()) {
      if (key <= nowMinute - WINDOW_MINUTES) this.buckets.delete(key);
    }
  }

  record(level: string): void {
    if (level !== 'error' && level !== 'warn') return;
    const nowMinute = Math.floor(Date.now() / 60_000);
    this.prune(nowMinute);
    let bucket = this.buckets.get(nowMinute);
    if (!bucket) {
      bucket = { error: 0, warn: 0 };
      this.buckets.set(nowMinute, bucket);
    }
    bucket[level] += 1;
  }

  /** 近 WINDOW_MINUTES 分钟的平均每分钟条数（含当前分钟，2 位小数） */
  perMinute(): Record<CountedLevel, number> {
    const nowMinute = Math.floor(Date.now() / 60_000);
    this.prune(nowMinute);
    let error = 0;
    let warn = 0;
    for (const bucket of this.buckets.values()) {
      error += bucket.error;
      warn += bucket.warn;
    }
    const round = (total: number) => Math.round((total / WINDOW_MINUTES) * 100) / 100;
    return { error: round(error), warn: round(warn) };
  }
}

const counter = new LogLevelCounter();

/** 供 logger 的 logMethod hook 在写入点调用的计数入口：只累加内存计数，永不抛错阻塞日志链路 */
export function recordLogLevel(level: string): void {
  try {
    counter.record(level);
  } catch { /* 计数失败不影响日志写入 */ }
}

export interface LogAlertMetrics {
  logErrorPerMin: number;
  logWarnPerMin: number;
}

/** 告警指标源：近 5 分钟 error / warn 日志平均每分钟条数 */
export function getLogAlertMetrics(): LogAlertMetrics {
  const { error, warn } = counter.perMinute();
  return { logErrorPerMin: error, logWarnPerMin: warn };
}
