import type { MiddlewareHandler } from 'hono';
import { runWithTraceId } from '../lib/context';

/**
 * 为每个请求建立链路关联 traceId（贯穿其触发的全部作业/事件/通知/任务 fan-out）。
 *
 * traceId 与 hono requestId 是**同一枚值**：`requestId()` 中间件已处理 `X-Request-Id`
 * 透传（一次前端操作的多个请求可共链）、UUID 生成与响应头回写；这里只负责把它装进
 * AsyncLocalStorage，使下游 `enqueueJob` / 事件 outbox / `submitAsyncTask` /
 * pino 日志（mixin 注入 reqId 字段）自动继承。
 *
 * 必须挂在 `requestId()` 之后。
 */
export const requestTraceMiddleware: MiddlewareHandler = async (c, next) => {
  await runWithTraceId(c.get('requestId'), () => next());
};
