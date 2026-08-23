import { getMastra } from './index';
import logger from '../logger';
import type { Hono } from 'hono';

/**
 * Mastra 标准 HTTP API(@mastra/hono MastraServer):
 * agents / workflows / datasets / experiments / traces 等端点,是 Studio 的后端。
 *
 * 挂载方式:懒初始化的子 Hono app,由主应用 `/api/mastra/*` 原样转发进入
 * (MastraServer 经官方 prefix 选项直接注册 /api/mastra/* 路由,无需 URL 重写)。
 * - 鉴权:主应用在转发前已执行系统 authMiddleware + 权限 guard,
 *   Mastra 侧不再配置 auth(信任上游);开发与生产同一配置。
 * - 惰性:首次访问才加载 @mastra/hono 与 Mastra 实例,零冷启动成本
 *   (文档模式是启动时 eager init,与本项目禁止启动加载重依赖的约束冲突)。
 */

let apiAppPromise: Promise<Hono> | null = null;

export function getMastraApiApp(): Promise<Hono> {
  apiAppPromise ??= (async () => {
    const [{ MastraServer }, { Hono }] = await Promise.all([
      import('@mastra/hono'),
      import('hono'),
    ]);
    const mastra = await getMastra();
    const sub = new Hono();
    const server = new MastraServer({
      app: sub as never,
      mastra: mastra as never,
      prefix: '/api/mastra',
      openapiPath: '/openapi.json',
    });
    await server.init();
    logger.info('[mastra] MastraServer mounted (sub-app, prefix /api/mastra)');
    return sub;
  })().catch((err) => {
    apiAppPromise = null;
    throw err;
  });
  return apiAppPromise;
}

/** 主应用转发 handler:/api/mastra/* 原样进入子 app(路由已带同前缀) */
export async function mastraApiProxy(req: Request): Promise<Response> {
  const sub = await getMastraApiApp();
  return sub.fetch(req);
}
