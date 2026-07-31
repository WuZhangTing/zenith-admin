import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { Position } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface PositionListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const positionKeys = {
  all: ['positions'] as const,
  allPositions: ['positions', 'all'] as const,
  lists: ['positions', 'list'] as const,
  list: (params: PositionListParams) => ['positions', 'list', params] as const,
  detail: (id: number | undefined) => ['positions', 'detail', id] as const,
  members: (id: number | undefined) => ['positions', 'members', id] as const,
};

export function usePositionList(params: PositionListParams) {
  return useQuery({
    queryKey: positionKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<Position>>(`/api/positions${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useAllPositions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: positionKeys.allPositions,
    queryFn: () => request.get<Position[]>('/api/positions/all').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
  });
}

export function usePositionDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: positionKeys.detail(id),
    queryFn: () => request.get<Position>(`/api/positions/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function usePositionMembers(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: positionKeys.members(id),
    queryFn: () => request.get<Array<{ id: number }>>(`/api/positions/${id}/members`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSavePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<Position> }) =>
      (id === undefined ? request.post<Position>('/api/positions', values) : request.put<Position>(`/api/positions/${id}`, values)).then(unwrap),
    onSuccess: (saved) => {
      // 写接口与详情接口同源（服务端同为 mapPosition），可直接回填，省掉一次详情回源
      qc.setQueryData(positionKeys.detail(saved.id), saved);
      void qc.invalidateQueries({ queryKey: positionKeys.lists });
      // 下拉源渲染岗位名称与状态，改名/停用后必须回源；未挂载时只标脏，代价接近零
      void qc.invalidateQueries({ queryKey: positionKeys.allPositions });
    },
  });
}

export function useDeletePositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      (ids.length === 1 ? request.delete<null>(`/api/positions/${ids[0]}`) : request.delete<null>('/api/positions/batch', { ids })).then(unwrap),
    onSuccess: (_data, ids) => {
      // 实体已不存在：移除缓存而非失效，否则仍挂载的详情会去请求一个必然 404 的资源
      for (const id of ids) {
        qc.removeQueries({ queryKey: positionKeys.detail(id) });
        qc.removeQueries({ queryKey: positionKeys.members(id) });
      }
      void qc.invalidateQueries({ queryKey: positionKeys.lists });
      void qc.invalidateQueries({ queryKey: positionKeys.allPositions });
    },
  });
}

export function useAssignPositionMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) =>
      request.put<null>(`/api/positions/${id}/members`, { userIds }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: positionKeys.members(id) });
      // 列表的「成员」列渲染 userCount / userPreview（仅列表接口注入），成员变更后必须回源
      void qc.invalidateQueries({ queryKey: positionKeys.lists });
      // detail 与 allPositions 都不含成员字段，不受影响
    },
  });
}
