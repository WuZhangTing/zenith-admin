import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tag } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface TagListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  groupName?: string;
}

/** 分组选项由标签聚合而来（/api/tags/groups），新建、改组、删除都可能改变集合 */
const TAG_GROUPS_KEY = ['tags', 'groups'] as const;

const crud = createCrudQueries<Tag, TagListParams>({
  resource: 'tags',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: TAG_GROUPS_KEY }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: TAG_GROUPS_KEY }),
});

export const tagKeys = { ...crud.keys, groups: TAG_GROUPS_KEY };

export const useTagList = crud.useList;
export const useTagDetail = crud.useDetail;
export const useSaveTag = crud.useSave;
/** 删除：单条走 DELETE /:id，多条走 DELETE /batch（合并原 useDeleteTag / useBatchDeleteTags） */
export const useDeleteTags = crud.useDelete;

export function useTagGroups() {
  return useQuery({
    queryKey: tagKeys.groups,
    queryFn: () => request.get<string[]>('/api/tags/groups').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useUpdateTagStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'enabled' | 'disabled' }) =>
      request.put<Tag>(`/api/tags/${id}`, { status }).then(unwrap),
    // 停启用不改变分组集合，只刷详情与列表
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tagKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: tagKeys.lists });
    },
  });
}
