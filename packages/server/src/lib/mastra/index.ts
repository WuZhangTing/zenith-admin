import { config } from '../../config';
import { getConfigValue } from '../system-config';
import logger from '../logger';
import type { PostgresStore, PgVector } from '@mastra/pg';
import type { Memory } from '@mastra/memory';
import type { AiModelSource } from '../ai/mastra-models';

/**
 * Mastra 运行时单例基座。
 *
 * 职责边界(运行时全量 + 薄业务账本):
 * - Mastra storage(PostgreSQL 同库独立 `mastra` schema,首次使用自动建表):
 *   memory(上下文引擎)/ workflows(挂起恢复)/ traces(执行观测)等运行时域的权威;
 * - 业务账本(public schema,drizzle 管理)仍是 UI 渲染与审计/反馈/用量的权威。
 *
 * ⚠️ @mastra/pg、@mastra/memory 均为重依赖:全部惰性加载,禁止顶层静态 import 值。
 * PostgresStore 内部使用 node-postgres 连接池(与 drizzle 的 postgres-js 各自独立),
 * 连接同一数据库;池上限独立配置,避免挤占业务连接。
 */

const MASTRA_SCHEMA = 'mastra';

let storagePromise: Promise<PostgresStore> | null = null;

/** Mastra 存储(PostgresStore,mastra schema);进程内单例 */
export function getMastraStorage(): Promise<PostgresStore> {
  storagePromise ??= (async () => {
    const { PostgresStore } = await import('@mastra/pg');
    const store = new PostgresStore({
      id: 'zenith-mastra-storage',
      connectionString: config.databaseUrl,
      schemaName: MASTRA_SCHEMA,
      max: 10,
    });
    await store.init();
    logger.info('[mastra] PostgresStore initialized (schema: mastra)');
    return store;
  })();
  return storagePromise;
}

let vectorPromise: Promise<PgVector> | null = null;

/** Mastra 向量库(PgVector,mastra schema);语义召回与知识库共用 */
export function getMastraVector(): Promise<PgVector> {
  vectorPromise ??= (async () => {
    const { PgVector } = await import('@mastra/pg');
    return new PgVector({
      id: 'zenith-mastra-vector',
      connectionString: config.databaseUrl,
      schemaName: MASTRA_SCHEMA,
      max: 5,
    });
  })();
  return vectorPromise;
}

/**
 * 解析 embedding 模型:系统配置 `ai_embedding_model`(裸模型名)+ 默认服务商的端点与密钥。
 * 返回 null 表示未配置(语义召回与向量检索退化为关闭/关键词)。
 */
export async function resolveEmbedderConfig(): Promise<{ key: string; source: AiModelSource; model: string } | null> {
  const model = (await getConfigValue('ai_embedding_model', '')).trim();
  if (!model) return null;
  // 惰性 import 避免模块加载环(providers.service 依赖 lib/ai 层)
  const { getRawDefaultProviderConfig } = await import('../../services/ai/ai-providers.service');
  const cfg = await getRawDefaultProviderConfig();
  if (!cfg) return null;
  return {
    key: `${cfg.providerId}|${cfg.baseUrl ?? ''}|${model}`,
    source: cfg,
    model,
  };
}

const memoryCache = new Map<string, Promise<Memory>>();

/**
 * 聊天记忆实例(按 embedding 配置缓存;配置变化自动重建)。
 * - 始终启用 lastMessages(最近 20 条,替代自研滑窗裁剪)
 * - 配置了 embedding 模型时启用 semantic recall(当前对话内向量召回早期内容)
 */
export function getChatMemory(): Promise<Memory> {
  return (async () => {
    const embedder = await resolveEmbedderConfig();
    const cacheKey = embedder?.key ?? 'no-embedder';
    let cached = memoryCache.get(cacheKey);
    if (!cached) {
      cached = (async () => {
        const [{ Memory }, storage] = await Promise.all([import('@mastra/memory'), getMastraStorage()]);
        if (!embedder) {
          return new Memory({
            storage: storage as never,
            options: { lastMessages: 20, semanticRecall: false },
          });
        }
        const [{ ModelRouterEmbeddingModel }, vector] = await Promise.all([
          import('@mastra/core/llm'),
          getMastraVector(),
        ]);
        const { toMastraModel } = await import('../ai/mastra-models');
        return new Memory({
          storage: storage as never,
          vector: vector as never,
          embedder: new ModelRouterEmbeddingModel(toMastraModel(embedder.source, embedder.model)),
          options: {
            lastMessages: 20,
            semanticRecall: { topK: 4, messageRange: 2, scope: 'thread' },
          },
        });
      })();
      memoryCache.set(cacheKey, cached);
      // 失败不缓存,允许下次重试
      cached.catch(() => memoryCache.delete(cacheKey));
    }
    return cached;
  })();
}

/** 对话 → Mastra thread 的确定性映射(不需要在账本加映射列) */
export function chatThreadId(conversationId: number): string {
  return `conv:${conversationId}`;
}

/** 用户 → Mastra resource 的确定性映射 */
export function chatResourceId(userId: number): string {
  return `user:${userId}`;
}
