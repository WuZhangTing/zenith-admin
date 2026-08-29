/**
 * OpenAPI 文档预热 worker：在独立线程中完成 ~10s 的同步文档生成与 gzip 预压缩，
 * 主线程（HTTP 服务）全程零阻塞。
 *
 * 副作用评估：本线程加载 app 模块图会创建一个 Redis 连接（随线程退出释放）；
 * postgres-js 惰性建连，无查询即无连接；pg-boss / 采样器 / 订阅者仅由
 * index.ts 启动，这里不会拉起。
 */
import { parentPort } from 'node:worker_threads';
import { gzipSync } from 'node:zlib';
import { createApp } from '../app';

const { buildOpenApiDocJson } = createApp();
const json = buildOpenApiDocJson();
const gzip = gzipSync(json);
parentPort?.postMessage({ json, gzip: new Uint8Array(gzip.buffer, gzip.byteOffset, gzip.byteLength) });
// worker 线程内的 process.exit 只终止本线程；避免 Redis 等打开句柄拖住线程不退
process.exit(0);
