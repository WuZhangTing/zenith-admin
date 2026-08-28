/**
 * 链路关联 traceId 的 AsyncLocalStorage 载体。
 *
 * 独立成零依赖模块：logger（pino mixin）与 context（业务侧 API）都要读它，
 * 而 context → db → logger 存在导入链，放在 context.ts 里会成环。
 *
 * traceId 与 hono requestId 是同一枚值（见 middleware/request-trace.ts）：
 * 请求内 = requestId；worker / 定时任务等离开请求作用域后由作业行恢复。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const traceIdStore = new AsyncLocalStorage<string>();

/**
 * 当前操作的链路关联 ID。由请求中间件（复用 hono requestId）或 worker 执行作业时
 * （继承作业自身 traceId）建立；脱离作用域时返回 undefined。
 * `enqueueJob`、事件 outbox 与任务中心会自动继承它，使一次操作的全部异步副作用共享同一 traceId。
 */
export function currentTraceId(): string | undefined {
  return traceIdStore.getStore();
}

/** 在给定 traceId 作用域内执行 fn：其内部新入队的作业/发射的事件都会继承该 traceId 形成链路。 */
export function runWithTraceId<T>(traceId: string, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(traceIdStore.run(traceId, fn));
}
