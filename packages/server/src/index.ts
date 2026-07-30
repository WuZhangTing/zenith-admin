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
import { createApp } from './app';
import { registerEventSubscribers } from './bootstrap/subscribers';
import { registerBackgroundWorkers } from './bootstrap/workers';
import { config } from './config';
import { closeDb } from './db';
import logger from './lib/logger';
import { metricsSampler } from './lib/metrics-sampler';
import { stopAllJobs } from './lib/pg-boss-scheduler';
import { closeRedis } from './lib/redis';
import { initTelemetry } from './lib/telemetry';
import { bootstrapRateLimitRules } from './middleware/rate-limit';
import { registerOpenWebhookSubscriber } from './services/open-platform/app-webhooks.service';

await initTelemetry();

const { app, injectWebSocket } = createApp();

// 指标采集副作用（不属于 app 装配，故不放进 createApp）：
// 监控页轻量采样器 + DB/Redis 时序指标（连接数 / 内存 / 命中率）
metricsSampler.start();
void import('./services/platform/monitor.service')
  .then((m) => m.registerMonitorExtCollector())
  .catch(() => {});

registerOpenWebhookSubscriber();
logger.info(`Server starting on port ${config.port}...`);
const server = serve({ fetch: app.fetch, port: config.port });
injectWebSocket(server);
logger.info(`Server running at http://localhost:${config.port}`);

// 启动后异步加载限流规则到内存（失败时使用代码内默认规则）
void bootstrapRateLimitRules();

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);
  // 30s 超时保护：防止 keep-alive 连接导致 server.close() 永久阻塞
  const closeServer = new Promise<void>((resolve) => server.close(() => resolve()));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 30_000));
  await Promise.race([closeServer, timeout]);
  try {
    metricsSampler.stop();
    stopAllJobs();
    await closeDb();
    await closeRedis();
    logger.info('Server shutdown complete');
  } catch (err) {
    logger.error('Error during shutdown', err);
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

await registerBackgroundWorkers();
registerEventSubscribers();
