import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiEvalDataset,
  AiEvalDatasetItem,
  AiEvalExperiment,
  AiEvalExperimentResult,
  CreateAiEvalDatasetInput,
  UpdateAiEvalDatasetInput,
  AddAiEvalItemsInput,
  RunAiExperimentInput,
} from '@zenith/shared/ai';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const aiEvalKeys = {
  all: ['ai-eval'] as const,
  datasets: ['ai-eval', 'datasets'] as const,
  items: (datasetId: string | null) => ['ai-eval', 'items', datasetId] as const,
  experiments: (datasetId: string | null) => ['ai-eval', 'experiments', datasetId] as const,
  experimentDetail: (datasetId: string | null, experimentId: string | null) =>
    ['ai-eval', 'experiment', datasetId, experimentId] as const,
};

export function useAiEvalDatasets() {
  return useQuery({
    queryKey: aiEvalKeys.datasets,
    queryFn: () => request.get<AiEvalDataset[]>('/api/ai/eval').then(unwrap),
  });
}

export function useAiEvalItems(datasetId: string | null) {
  return useQuery({
    queryKey: aiEvalKeys.items(datasetId),
    queryFn: () => request.get<AiEvalDatasetItem[]>(`/api/ai/eval/${datasetId}/items`).then(unwrap),
    enabled: datasetId !== null,
  });
}

export function useSaveAiEvalDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: CreateAiEvalDatasetInput | UpdateAiEvalDatasetInput }) =>
      (id === undefined
        ? request.post<AiEvalDataset>('/api/ai/eval', values)
        : request.put<AiEvalDataset>(`/api/ai/eval/${id}`, values)
      ).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiEvalKeys.all }),
  });
}

export function useDeleteAiEvalDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete<null>(`/api/ai/eval/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiEvalKeys.all }),
  });
}

export function useAddAiEvalItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, values }: { datasetId: string; values: AddAiEvalItemsInput }) =>
      request.post<AiEvalDatasetItem[]>(`/api/ai/eval/${datasetId}/items`, values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiEvalKeys.all }),
  });
}

export function useDeleteAiEvalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, itemId }: { datasetId: string; itemId: string }) =>
      request.delete<null>(`/api/ai/eval/${datasetId}/items/${itemId}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiEvalKeys.all }),
  });
}

export function useRunAiExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, values }: { datasetId: string; values: RunAiExperimentInput }) =>
      request.post<{ experimentId: string; name: string }>(`/api/ai/eval/${datasetId}/experiments`, values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiEvalKeys.all }),
  });
}

type ExperimentsRefetchInterval =
  | number
  | false
  | ((query: { state: { data: AiEvalExperiment[] | undefined } }) => number | false);

export function useAiEvalExperiments(datasetId: string | null, refetchInterval?: ExperimentsRefetchInterval) {
  return useQuery({
    queryKey: aiEvalKeys.experiments(datasetId),
    queryFn: () => request.get<AiEvalExperiment[]>(`/api/ai/eval/${datasetId}/experiments`).then(unwrap),
    enabled: datasetId !== null,
    refetchInterval,
  });
}

export function useAiEvalExperimentDetail(datasetId: string | null, experimentId: string | null) {
  return useQuery({
    queryKey: aiEvalKeys.experimentDetail(datasetId, experimentId),
    queryFn: () =>
      request
        .get<{ experiment: AiEvalExperiment; results: AiEvalExperimentResult[] }>(
          `/api/ai/eval/${datasetId}/experiments/${experimentId}`,
        )
        .then(unwrap),
    enabled: datasetId !== null && experimentId !== null,
  });
}
