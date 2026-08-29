/**
 * OpenAPI 文档预热编排：监听启动后 spawn worker 线程生成文档并回填进程内缓存。
 *
 * - 主线程零阻塞、启动时间零影响（spawn 本身微秒级）
 * - worker 失败（如运行时不支持 TS worker）只降级为「首个文档请求走懒生成」，
 *   不影响服务可用性
 * - worker 已 unref：优雅停机不会被预热拖住
 */
import { Worker } from 'node:worker_threads';
import logger from '../lib/logger';
import { setCachedOpenApiDoc, getCachedOpenApiDoc } from '../lib/openapi-doc-cache';

export function warmupOpenApiDoc(): void {
  // dev（tsx）运行 .ts，编译产物运行 .js；worker 线程继承 execArgv（含 tsx loader）
  const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
  const workerUrl = new URL(`./openapi-warmup-worker${ext}`, import.meta.url);
  let worker: Worker;
  const startedAt = Date.now();
  try {
    worker = new Worker(workerUrl);
  } catch (err) {
    logger.warn('[openapi] 预热 worker 启动失败，首个文档请求将走懒生成', err);
    return;
  }
  worker.once('message', ({ json, gzip }: { json: string; gzip: Uint8Array }) => {
    // 懒生成可能已抢先完成，避免用旧结果覆盖（内容一致，纯防御）
    if (!getCachedOpenApiDoc()) setCachedOpenApiDoc(json, gzip);
    logger.info(`[openapi] 文档预热完成（${Date.now() - startedAt}ms, 原文 ${Math.round(json.length / 1024)}kB / gzip ${Math.round(gzip.byteLength / 1024)}kB）`);
  });
  worker.once('error', (err) => {
    logger.warn('[openapi] 预热 worker 执行失败，首个文档请求将走懒生成', err);
  });
  worker.unref();
}
