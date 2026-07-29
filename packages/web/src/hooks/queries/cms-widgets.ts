import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AsyncTask,
  CmsWidget,
  CmsWidgetPreview,
  CmsWidgetRef,
  CmsWidgetRendererKey,
  CmsWidgetRendererOption,
  CmsWidgetSlot,
  CmsWidgetStatus,
  CmsWidgetType,
  PaginatedResponse,
} from '@zenith/shared';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface CmsWidgetListParams {
  page: number;
  pageSize: number;
  siteId: number | undefined;
  keyword?: string;
  status?: CmsWidgetStatus;
  type?: CmsWidgetType;
}

export const cmsWidgetKeys = {
  all: ['cms-widgets'] as const,
  lists: ['cms-widgets', 'list'] as const,
  list: (params: CmsWidgetListParams) => ['cms-widgets', 'list', params] as const,
  detail: (id: number | undefined) => ['cms-widgets', 'detail', id] as const,
  refs: (id: number | undefined) => ['cms-widgets', 'refs', id] as const,
  preview: (id: number | undefined, rendererKey?: CmsWidgetRendererKey) =>
    ['cms-widgets', 'preview', id, rendererKey ?? 'default'] as const,
  options: (siteId: number | undefined) => ['cms-widgets', 'options', siteId] as const,
  renderers: (siteId: number | undefined, type: CmsWidgetType) =>
    ['cms-widgets', 'renderers', siteId, type] as const,
  slots: (siteId: number | undefined) => ['cms-widgets', 'slots', siteId] as const,
};

export function useCmsWidgetList(params: CmsWidgetListParams) {
  return useQuery({
    queryKey: cmsWidgetKeys.list(params),
    queryFn: () => request
      .get<PaginatedResponse<CmsWidget>>(`/api/cms/widgets${toQueryString(params)}`)
      .then(unwrap),
    enabled: params.siteId !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useCmsWidgetDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cmsWidgetKeys.detail(id),
    queryFn: () => request.get<CmsWidget>(`/api/cms/widgets/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function usePublishedCmsWidgets(siteId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cmsWidgetKeys.options(siteId),
    queryFn: () => request.get<CmsWidget[]>(`/api/cms/widgets/options?siteId=${siteId}`).then(unwrap),
    enabled: enabled && siteId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCmsWidgetRenderers(
  siteId: number | undefined,
  type: CmsWidgetType = 'manual-list',
  enabled = true,
) {
  return useQuery({
    queryKey: cmsWidgetKeys.renderers(siteId, type),
    queryFn: () => request
      .get<CmsWidgetRendererOption[]>(`/api/cms/widgets/renderers${toQueryString({ siteId, type })}`)
      .then(unwrap),
    enabled: enabled && siteId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCmsWidgetRefs(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cmsWidgetKeys.refs(id),
    queryFn: () => request.get<CmsWidgetRef[]>(`/api/cms/widgets/${id}/refs`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCmsWidgetPreview(
  id: number | undefined,
  rendererKey?: CmsWidgetRendererKey,
  enabled = true,
) {
  return useQuery({
    queryKey: cmsWidgetKeys.preview(id, rendererKey),
    queryFn: () => request
      .get<CmsWidgetPreview>(`/api/cms/widgets/${id}/preview${toQueryString({ rendererKey })}`)
      .then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCmsWidgetSlots(siteId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cmsWidgetKeys.slots(siteId),
    queryFn: () => request.get<CmsWidgetSlot[]>(`/api/cms/widgets/slots?siteId=${siteId}`).then(unwrap),
    enabled: enabled && siteId !== undefined,
  });
}

export function useSaveCmsWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<CmsWidget>('/api/cms/widgets', values)
        : request.put<CmsWidget>(`/api/cms/widgets/${id}`, values)
      ).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all }),
  });
}

export function usePublishCmsWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<CmsWidget>(`/api/cms/widgets/${id}/publish`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all }),
  });
}

export function useOfflineCmsWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<CmsWidget>(`/api/cms/widgets/${id}/offline`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all }),
  });
}

export function useDeleteCmsWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/cms/widgets/${id}`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all }),
  });
}

export function useCmsWidgetBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: number[]; action: 'publish' | 'offline' | 'delete' }) =>
      request.post<AsyncTask>('/api/cms/widgets/batch', input).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all }),
  });
}

export function useSaveCmsWidgetSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      slotKey,
      values,
    }: {
      slotKey: 'home.sidebar';
      values: {
        siteId: number;
        widgetId: number | null;
        rendererKey: CmsWidgetRendererKey;
        styleProps?: Record<string, unknown>;
      };
    }) => request.put<CmsWidgetSlot[]>(`/api/cms/widgets/slots/${slotKey}`, values).then(unwrap),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.slots(variables.values.siteId) });
      void queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.all });
    },
  });
}
