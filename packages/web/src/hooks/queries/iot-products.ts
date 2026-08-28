import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateIotEventInput, CreateIotPropertyInput, CreateIotServiceInput, ImportIotTslInput,
  IotProduct, IotProductEvent, IotProductProperty, IotProductService, IotThingModel,
  UpdateIotEventInput, UpdateIotPropertyInput, UpdateIotServiceInput,
} from '@zenith/shared/iot';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface IotProductListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: iotProductKeys,
  useList: useIotProductList,
  useSave: useSaveIotProduct,
  useDelete: useDeleteIotProducts,
  useLookup: useAllIotProducts,
} = createCrudQueries<IotProduct, IotProductListParams, Partial<IotProduct>>({
  resource: 'iot-products',
  path: '/api/iot/products',
  deleteMode: 'single',
  lookup: true,
});

// ─── 物模型（独立命名空间：随产品编辑失效，不与产品列表连坐）──────────────────
export const iotModelKeys = {
  all: ['iot-model'] as const,
  of: (productId: number) => ['iot-model', productId] as const,
};

export function useIotThingModel(productId: number | null) {
  return useQuery({
    queryKey: iotModelKeys.of(productId ?? 0),
    queryFn: () => request.get<IotThingModel>(`/api/iot/products/${productId}/model`).then(unwrap),
    enabled: productId !== null,
  });
}

/** 物模型写操作共用失效：模型本体 + 产品列表（三元组计数列） */
function useInvalidateModel() {
  const qc = useQueryClient();
  return (productId: number) => {
    void qc.invalidateQueries({ queryKey: iotModelKeys.of(productId) });
    void qc.invalidateQueries({ queryKey: iotProductKeys.lists });
  };
}

export function useSaveIotProperty() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id, values }: { productId: number; id?: number; values: CreateIotPropertyInput | UpdateIotPropertyInput }) =>
      (id === undefined
        ? request.post<IotProductProperty>(`/api/iot/products/${productId}/properties`, values)
        : request.put<IotProductProperty>(`/api/iot/products/${productId}/properties/${id}`, values)
      ).then(unwrap),
    onSuccess: (_saved, { productId }) => invalidate(productId),
  });
}

export function useDeleteIotProperty() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id }: { productId: number; id: number }) =>
      request.delete<null>(`/api/iot/products/${productId}/properties/${id}`).then(unwrap),
    onSuccess: (_data, { productId }) => invalidate(productId),
  });
}

export function useSaveIotService() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id, values }: { productId: number; id?: number; values: CreateIotServiceInput | UpdateIotServiceInput }) =>
      (id === undefined
        ? request.post<IotProductService>(`/api/iot/products/${productId}/services`, values)
        : request.put<IotProductService>(`/api/iot/products/${productId}/services/${id}`, values)
      ).then(unwrap),
    onSuccess: (_saved, { productId }) => invalidate(productId),
  });
}

export function useDeleteIotService() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id }: { productId: number; id: number }) =>
      request.delete<null>(`/api/iot/products/${productId}/services/${id}`).then(unwrap),
    onSuccess: (_data, { productId }) => invalidate(productId),
  });
}

export function useSaveIotEvent() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id, values }: { productId: number; id?: number; values: CreateIotEventInput | UpdateIotEventInput }) =>
      (id === undefined
        ? request.post<IotProductEvent>(`/api/iot/products/${productId}/events`, values)
        : request.put<IotProductEvent>(`/api/iot/products/${productId}/events/${id}`, values)
      ).then(unwrap),
    onSuccess: (_saved, { productId }) => invalidate(productId),
  });
}

export function useDeleteIotEvent() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, id }: { productId: number; id: number }) =>
      request.delete<null>(`/api/iot/products/${productId}/events/${id}`).then(unwrap),
    onSuccess: (_data, { productId }) => invalidate(productId),
  });
}

export function useImportIotTsl() {
  const invalidate = useInvalidateModel();
  return useMutation({
    mutationFn: ({ productId, values }: { productId: number; values: ImportIotTslInput }) =>
      request.post<IotThingModel>(`/api/iot/products/${productId}/model/import`, values).then(unwrap),
    onSuccess: (_saved, { productId }) => invalidate(productId),
  });
}
