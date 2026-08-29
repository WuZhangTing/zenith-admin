import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RateLimitAlgorithm, RateLimitKeyType, RateLimitMode, RateLimitMountSource } from '@zenith/shared/platform';
import { config } from '@/config';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export type { RateLimitAlgorithm, RateLimitKeyType, RateLimitMode, RateLimitMountSource };

export interface RateLimitRule {
  id: number;
  name: string;
  description: string | null;
  windowMs: number;
  limit: number;
  keyType: RateLimitKeyType;
  enabled: boolean;
  mode: RateLimitMode;
  algorithm: RateLimitAlgorithm;
  allowlist: string[];
  priority: number;
  alertThreshold: number | null;
  blockedMessage: string | null;
  pathPatterns: string[];
  /** 是否内置规则（不可删除，由服务端下发） */
  predefined: boolean;
  /** 挂载来源：code=代码挂载；path=路径绑定；none=未生效（死规则） */
  mountSource: RateLimitMountSource;
  createdAt: string;
  updatedAt: string;
}

export interface RecentBlock {
  at: string;
  key: string;
  path: string;
  /** 观察模式命中：只记数未实际拦截 */
  monitored: boolean;
  /** 手动封禁命中 */
  banned: boolean;
}

export interface RateLimitStatItem {
  name: string;
  description: string | null;
  windowMs: number;
  limit: number;
  keyType: string;
  enabled: boolean;
  mode: RateLimitMode;
  hitCount: number;
  blockedCount: number;
  blockRate: number;
  recentBlocks: RecentBlock[];
  hourlySeries: { hour: string; hits: number; blocked: number }[];
}

export interface RateLimitStats {
  items: RateLimitStatItem[];
}

export const rateLimitKeys = {
  all: ['rate-limit'] as const,
  rules: ['rate-limit', 'rules'] as const,
  stats: ['rate-limit', 'stats'] as const,
  bans: ['rate-limit', 'bans'] as const,
  apiPaths: ['rate-limit', 'api-paths'] as const,
};

export interface RateLimitBan {
  name: string;
  key: string;
  expiresAt: string;
  remainingSeconds: number;
}

/** 规则配置：仅管理操作后失效，不随统计轮询刷新 */
export function useRateLimitRules() {
  return useQuery({
    queryKey: rateLimitKeys.rules,
    queryFn: () => request.get<RateLimitRule[]>('/api/rate-limit/rules').then(unwrap),
  });
}

/** 统计数据：30 秒轮询 */
export function useRateLimitStats() {
  return useQuery({
    queryKey: rateLimitKeys.stats,
    queryFn: () => request.get<RateLimitStats>('/api/rate-limit/stats').then(unwrap),
    refetchInterval: 30 * 1000,
  });
}

export function useRateLimitApiPaths() {
  return useQuery({
    queryKey: rateLimitKeys.apiPaths,
    queryFn: async () => {
      // openapi.json 返回原始 OpenAPI 文档（非 ApiResponse 信封），不走 request；但仍需拼接 API 基址
      const res = await fetch(`${config.apiBaseUrl}/api/openapi.json`);
      const spec = (await res.json()) as { paths?: Record<string, unknown> };
      return Object.keys(spec.paths ?? {})
        .filter((p) => p.startsWith('/api/'))
        .sort((a, b) => a.localeCompare(b))
        .map((p) => ({ label: p, value: p }));
    },
  });
}

export function useSaveRateLimitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<RateLimitRule> }) =>
      (id === undefined
        ? request.post<RateLimitRule>('/api/rate-limit/rules', values)
        : request.patch<RateLimitRule>(`/api/rate-limit/rules/${id}`, values)
      ).then(unwrap),
    // 统计接口的规则元信息（enabled/mode/窗口）派生自规则配置，两者都需失效
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.rules });
      void qc.invalidateQueries({ queryKey: rateLimitKeys.stats });
    },
  });
}

export function useDeleteRateLimitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/rate-limit/rules/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.rules });
      void qc.invalidateQueries({ queryKey: rateLimitKeys.stats });
    },
  });
}

/** 解封返回服务端结果消息（成功 / 未找到活跃计数窗口），由调用方展示 */
export function useUnblockRateLimitKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, key }: { name: string; key: string }) => {
      const res = await request.post<null>('/api/rate-limit/unblock', { name, key });
      unwrap(res);
      return res.message;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.stats });
    },
  });
}

export function useResetRateLimitStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request.post<null>('/api/rate-limit/reset-stats', { name }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.stats });
    },
  });
}

/** 活跃封禁列表：30 秒轮询（TTL 持续变化） */
export function useRateLimitBans() {
  return useQuery({
    queryKey: rateLimitKeys.bans,
    queryFn: () => request.get<RateLimitBan[]>('/api/rate-limit/bans').then(unwrap),
    refetchInterval: 30 * 1000,
  });
}

export function useBanRateLimitKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, key, durationSeconds }: { name: string; key: string; durationSeconds: number }) =>
      request.post<null>('/api/rate-limit/ban', { name, key, durationSeconds }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.bans });
    },
  });
}

/** 解除封禁返回服务端结果消息（成功 / 封禁不存在），由调用方展示 */
export function useUnbanRateLimitKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, key }: { name: string; key: string }) => {
      const res = await request.post<null>('/api/rate-limit/unban', { name, key });
      unwrap(res);
      return res.message;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rateLimitKeys.bans });
    },
  });
}
