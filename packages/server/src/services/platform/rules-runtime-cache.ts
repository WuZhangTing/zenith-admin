/**
 * 规则中心运行时缓存：各资产（决策表快照/灰度配置、决策流、评分卡）按 kind|key 的短 TTL 缓存。
 * 任一资产的发布 / 停用 / 回滚 / 更新 / 删除后调用 invalidateRuleRuntimeCache() 全量失效，
 * 保证业务侧在一个 TTL 周期内一定拿到新发布内容。
 */
const RULE_RUNTIME_CACHE_TTL_MS = 60_000;

const store = new Map<string, { at: number; value: unknown }>();

/** 按 kind|key 读缓存，未命中或过期时执行 loader 并回填 */
export async function cachedRuleRuntime<T>(kind: string, key: string, loader: () => Promise<T>): Promise<T> {
  const cacheKey = `${kind}|${key}`;
  const hit = store.get(cacheKey);
  if (hit && Date.now() - hit.at < RULE_RUNTIME_CACHE_TTL_MS) return hit.value as T;
  const value = await loader();
  store.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** 失效全部规则运行时缓存（发布/停用/回滚/更新/删除后调用） */
export function invalidateRuleRuntimeCache(): void {
  store.clear();
}
