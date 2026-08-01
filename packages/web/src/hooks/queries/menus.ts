import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Menu } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';

export const menuKeys = {
  all: ['menus'] as const,
  tree: ['menus', 'tree'] as const,
  /** 当前登录用户可见菜单树（侧边栏与动态路由注册的数据源） */
  userTree: ['menus', 'user-tree'] as const,
  detail: (id: number | undefined) => ['menus', 'detail', id] as const,
};

/**
 * 完整菜单树（菜单管理、角色授权、租户套餐分配、403/404 判别等场景全局共享缓存）。
 * 失败静默：错误展示责任在消费方（App 判别器降级 403→404，MenusPage 展示错误横幅）。
 */
export function useMenuTree(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: menuKeys.tree,
    queryFn: () => request.get<Menu[]>('/api/menus', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
  });
}

/** 当前用户可见菜单树；失败静默，由 App 渲染显式重试页（空菜单不得伪装成正常态） */
export function useCurrentUserMenuTree() {
  return useQuery({
    queryKey: menuKeys.userTree,
    queryFn: () => request.get<Menu[]>('/api/menus/user', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useMenuDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: menuKeys.detail(id),
    queryFn: () => request.get<Menu>(`/api/menus/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<Menu> }) =>
      (id === undefined
        ? request.post<Menu>('/api/menus', values)
        : request.put<Menu>(`/api/menus/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: menuKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: menuKeys.tree });
    },
  });
}

export function useDeleteMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/menus/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: menuKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: menuKeys.tree });
    },
  });
}
