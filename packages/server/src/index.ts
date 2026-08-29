/**
 * 服务启动编排。
 *
 * 本文件只负责"把已装配好的 app 跑起来"：遥测初始化 → 装配 app → 启动监听 →
 * 拉起后台 worker 与事件订阅者 → 安装优雅停机钩子。
 *
 * 应用装配本身在 src/app.ts 的 createApp()，路由按域装配在 src/routes/。
 * 此前这三件事全挤在本文件里（776 行 / 296 个 import / 236 个 app.route），
 * 任何域新增端点都要改这唯一的公共文件，且 app 无法脱离 serve() 被构造。
 */
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { registerEventSubscribers } from './bootstrap/subscribers';
import { registerBackgroundWorkers } from './bootstrap/workers';
import { config } from './config';
import { closeDb } from './db';
import logger from './lib/logger';
import { metricsSampler } from './lib/metrics-sampler';
import { stopAllJobs } from './lib/pg-boss-scheduler';
import { closeRedis } from './lib/redis';
import { initTelemetry, shutdownTelemetry } from './lib/telemetry';
import { bootstrapRateLimitRules } from './middleware/rate-limit';
import { registerOpenWebhookSubscriber } from './services/open-platform/app-webhooks.service';

await initTelemetry();

const { app } = createApp();

// 指标采集副作用（不属于 app 装配，故不放进 createApp）：
// 监控页轻量采样器 + DB/Redis 时序指标（连接数 / 内存 / 命中率）
metricsSampler.start();
void import('./services/platform/monitor.service')
  .then((m) => m.registerMonitorExtCollector())
  .catch(() => {});

registerOpenWebhookSubscriber();
logger.info(`Server starting on port ${config.port}...`);
// WebSocket 由 @hono/node-server 内建支持：serve() 接管 upgrade 事件，
// 握手请求走正常 fetch 管线，响应头会被带入握手响应。
// noServer 必须为 true——HTTP 监听由 serve() 持有，wss 只负责协议升级。
const wss = new WebSocketServer({ noServer: true });
const server = serve({ fetch: app.fetch, port: config.port, websocket: { server: wss } });

// 升级请求被拒绝时（如向非 WS 路径发起 upgrade），socket 已脱离 http.Server 托管，
// 其上的 'error' 无人监听会直接冒泡成 uncaughtException 打死进程——这是可被未认证
// 远端触发的 DoS（upgrade 到任意非 WS 路径后立刻 RST 即可）。
// 在 'connection' 阶段统一兜底：此时拿到的 socket 与后续 upgrade 用的是同一个对象。
server.on('connection', (socket) => {
  socket.on('error', (err: NodeJS.ErrnoException) => {
    logger.debug('[socket] connection error', { code: err.code, message: err.message });
  });
});

logger.info(`Server running at http://localhost:${config.port}`);

// 启动后异步加载限流规则到内存（失败时使用代码内默认规则）
void bootstrapRateLimitRules();

let shuttingDown = false;

/** 给停机清理步骤加超时：任一外部资源关闭卡住不应阻塞进程退出 */
function withTimeout(label: string, p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    p.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(() => {
      logger.warn(`Shutdown step "${label}" timed out after ${ms}ms, continuing`);
      resolve();
    }, ms).unref()),
  ]);
}

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);
  // 硬闸：无论清理卡在哪一步，15s 后强制退出。
  // 此前 stopAllJobs/closeDb/closeRedis 无超时，任一环节挂起会导致
  // 「监听已关闭但进程永不退出」，tsx watch 等不到子进程退出也不会重启。
  setTimeout(() => {
    logger.error('Graceful shutdown deadline exceeded, forcing exit');
    process.exit(1);
  }, 15_000).unref();
  // 10s 超时保护：防止 keep-alive 连接导致 server.close() 永久阻塞
  const closeServer = new Promise<void>((resolve) => server.close(() => resolve()));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10_000));
  await Promise.race([closeServer, timeout]);
  try {
    metricsSampler.stop();
    // flush OTel span 缓冲：BatchSpanProcessor 按批发送（默认 ~5s 一批），不 flush 则每次停机
    // 固定丢失最后一批未导出的 span。放在清理链前部：监听已关闭、span 已完整，且导出走
    // 独立 HTTP 出口，不依赖后续 DB/Redis；未启用 OTel 时为 no-op
    await withTimeout('shutdownTelemetry', shutdownTelemetry(), 5_000);
    await withTimeout('stopAllJobs', Promise.resolve(stopAllJobs()), 5_000);
    // 结束全部终端会话：避免留下孤儿 PTY 进程与永远停留在 active 的记录
    const { endAllSessions } = await import('./lib/terminal-session-registry');
    const { stopTerminalSessionReaper } = await import('./services/ops/terminal-sessions.service');
    stopTerminalSessionReaper();
    endAllSessions('server_shutdown');
    const { closeAllHostConnections } = await import('./lib/host-exec');
    closeAllHostConnections();
    await withTimeout('closeDb', closeDb(), 5_000);
    await withTimeout('closeRedis', closeRedis(), 5_000);
    logger.info('Server shutdown complete');
  } catch (err) {
    logger.error('Error during shutdown', err);
  } finally {
    process.exit(0);
  }
}

// 重复收到信号（如连续 Ctrl+C）时立即强退，不再等待清理
process.on('SIGINT', () => { if (shuttingDown) process.exit(130); void shutdown('SIGINT'); });
process.on('SIGTERM', () => { if (shuttingDown) process.exit(143); void shutdown('SIGTERM'); });

await registerBackgroundWorkers();
registerEventSubscribers();
