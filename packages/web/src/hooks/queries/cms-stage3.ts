import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AsyncTask,
  CmsPublishingDetail,
  CmsPublishingTask,
  CmsPublishArtifact,
  CmsPublishArtifactStatus,
  CmsPublishSubmitInput,
  CmsPublishTargetType,
  PaginatedResponse,
} from '@zenith/shared';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface CmsPublishingListParams {
  page: number;
  pageSize: number;
  siteId?: number;
  targetType?: CmsPublishTargetType;
  status?: string;
  taskType?: string;
  createdBy?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
}

export interface CmsPublishArtifactListParams {
  page: number;
  pageSize: number;
  siteId?: number;
  taskId?: number;
  targetType?: CmsPublishTargetType;
  status?: CmsPublishArtifactStatus;
  /** 0 = 仅站点级产物（sitemap/rss 等无归属通道） */
  startTime?: string;
  endTime?: string;
  keyword?: string;
}

export const cmsPublishingKeys = {
  all: ['cms-publishing'] as const,
  lists: ['cms-publishing', 'list'] as const,
  list: (params: CmsPublishingListParams) => ['cms-publishing', 'list', params] as const,
  detail: (id: number | undefined) => ['cms-publishing', 'detail', id] as const,
  artifacts: ['cms-publishing', 'artifacts'] as const,
  artifactList: (params: CmsPublishArtifactListParams) => ['cms-publishing', 'artifacts', params] as const,
};

export function useCmsPublishingList(params: CmsPublishingListParams, enabled = true) {
  return useQuery({
    queryKey: cmsPublishingKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<CmsPublishingTask>>(`/api/cms/publishing${toQueryString(params)}`).then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => query.state.data?.list.some((item) => ['pending', 'running'].includes(item.status)) ? 4000 : false,
  });
}

export function useCmsPublishingDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cmsPublishingKeys.detail(id),
    queryFn: () => request.get<CmsPublishingDetail>(`/api/cms/publishing/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
    refetchInterval: (query) => query.state.data && ['pending', 'running'].includes(query.state.data.task.status) ? 3000 : false,
  });
}

export function useCmsPublishArtifactList(params: CmsPublishArtifactListParams, enabled = true) {
  return useQuery({
    queryKey: cmsPublishingKeys.artifactList(params),
    queryFn: () => request.get<PaginatedResponse<CmsPublishArtifact>>(`/api/cms/publishing/artifacts${toQueryString(params)}`).then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSubmitCmsPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CmsPublishSubmitInput) =>
      request.post<AsyncTask>('/api/cms/publishing/submit', input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: cmsPublishingKeys.all }),
  });
}

export function useCmsPublishingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'cancel' | 'resume' | 'restart' | 'rebuild' }) =>
      request.post<AsyncTask>(`/api/cms/publishing/${id}/${action}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: cmsPublishingKeys.all }),
  });
}

export function useBatchCmsPublishingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: 'cancel' | 'resume' | 'restart' | 'rebuild' }) =>
      request.post<{ affected: number; errors: Array<{ id: number; message: string }> }>('/api/cms/publishing/batch-action', { ids, action }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: cmsPublishingKeys.all }),
  });
}