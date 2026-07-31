import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Menu } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';

export const menuKeys = {
  all: ['menus'] as const,
  tree: ['menus', 'tree'] as const,
  detail: (id: number | undefined) => ['menus', 'detail', id] as const,
};

/** 完整菜单树（菜单管理、角色授权、租户套餐分配等场景全局共享缓存） */
export function useMenuTree(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: menuKeys.tree,
    queryFn: () => request.get<Menu[]>('/api/menus').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
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
