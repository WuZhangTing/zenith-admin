import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WikiSpace, WikiSpaceMember, SaveWikiSpaceMembersInput } from '@zenith/shared/wiki';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WikiSpaceListParams extends CrudListParams {
  keyword?: string;
  visibility?: string;
  status?: string;
}

/** 「我可访问的空间」独立于管理列表，空间增删改后需一并失效 */
export const myWikiSpacesKey = ['wiki-spaces', 'my'] as const;

export const {
  keys: wikiSpaceKeys,
  useList: useWikiSpaceList,
  useDetail: useWikiSpaceDetail,
  useSave: useSaveWikiSpace,
  useDelete: useDeleteWikiSpaces,
} = createCrudQueries<WikiSpace, WikiSpaceListParams>({
  resource: 'wiki-spaces',
  path: '/api/wiki/spaces',
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: myWikiSpacesKey }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: myWikiSpacesKey }),
});

/** 文档中心侧栏空间下拉（低频，全局共享） */
export function useMyWikiSpaces() {
  return useQuery({
    queryKey: myWikiSpacesKey,
    queryFn: () => request.get<WikiSpace[]>('/api/wiki/spaces/my').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

// ─── 空间成员（独立生命周期的子资源，另起命名空间）────────────────────────────

export const wikiSpaceMemberKeys = {
  of: (spaceId: number | undefined) => ['wiki-space-members', spaceId] as const,
};

export function useWikiSpaceMembers(spaceId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: wikiSpaceMemberKeys.of(spaceId),
    queryFn: () => request.get<WikiSpaceMember[]>(`/api/wiki/spaces/${spaceId}/members`).then(unwrap),
    enabled: enabled && spaceId !== undefined,
  });
}

/** 保存成员后：成员子键 + 空间列表（memberCount 派生列）都要刷新 */
export function useSaveWikiSpaceMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ spaceId, members }: { spaceId: number } & SaveWikiSpaceMembersInput) =>
      request.put<null>(`/api/wiki/spaces/${spaceId}/members`, { members }).then(unwrap),
    onSuccess: (_data, { spaceId }) => {
      void qc.invalidateQueries({ queryKey: wikiSpaceMemberKeys.of(spaceId) });
      void qc.invalidateQueries({ queryKey: wikiSpaceKeys.lists });
      // 成员角色变化影响「我可访问的空间」里的 myRole
      void qc.invalidateQueries({ queryKey: myWikiSpacesKey });
    },
  });
}
