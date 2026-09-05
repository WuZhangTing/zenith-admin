import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { QueryOf } from '@zenith/shared/core';
import {
  iotProductContract,
  type CreateIotEventInput, type CreateIotPropertyInput, type CreateIotServiceInput,
  type IotProductEvent, type IotProductProperty, type IotProductService,
} from '@zenith/shared/iot';
import { api, contractKey, createResourceQueries, useApiMutation, useApiQuery } from '@/lib/contract-query';

export type IotProductListParams = NonNullable<QueryOf<typeof iotProductContract.list>>;

export const {
  keys: iotProductKeys,
  useList: useIotProductList,
  useDetail: useIotProductDetail,
  useSave: useSaveIotProduct,
  useDelete: useDeleteIotProducts,
  useLookup: useAllIotProducts,
} = createResourceQueries(iotProductContract);

// ─── 物模型（独立命名空间：随产品编辑失效，不与产品列表连坐）──────────────────
export const iotModelKeys = {
  all: contractKey(iotProductContract.model),
  of: (productId: number) => contractKey(iotProductContract.model, { params: { id: productId } }),
};

export function useIotThingModel(productId: number | null) {
  return useApiQuery(iotProductContract.model, { params: { id: productId ?? 0 } }, { enabled: productId !== null });
}

/** 物模型写操作共用失效：模型本体 + 产品列表（三元组计数列） */
function invalidateModel(qc: QueryClient, productId: number) {
  void qc.invalidateQueries({ queryKey: iotModelKeys.of(productId) });
  void qc.invalidateQueries({ queryKey: iotProductKeys.lists });
}

/** 物模型子资源的保存变量：无 id 走新增，有 id 走更新；载荷为新增入参的部分形态（必填由表单 rules 保证） */
interface IotModelSaveVars<TCreate> {
  productId: number;
  id?: number;
  values: Partial<TCreate>;
}

export function useSaveIotProperty() {
  const qc = useQueryClient();
  return useMutation<IotProductProperty, Error, IotModelSaveVars<CreateIotPropertyInput>>({
    mutationFn: ({ productId, id, values }) => (id === undefined
      ? api(iotProductContract.createProperty, { params: { id: productId }, body: values as CreateIotPropertyInput })
      : api(iotProductContract.updateProperty, { params: { id: productId, propertyId: id }, body: values })),
    onSuccess: (_saved, { productId }) => invalidateModel(qc, productId),
  });
}

export function useDeleteIotProperty() {
  return useApiMutation(iotProductContract.removeProperty, {
    invalidate: (qc, _data, { params }) => invalidateModel(qc, params.id),
  });
}

export function useSaveIotService() {
  const qc = useQueryClient();
  return useMutation<IotProductService, Error, IotModelSaveVars<CreateIotServiceInput>>({
    mutationFn: ({ productId, id, values }) => (id === undefined
      ? api(iotProductContract.createService, { params: { id: productId }, body: values as CreateIotServiceInput })
      : api(iotProductContract.updateService, { params: { id: productId, serviceId: id }, body: values })),
    onSuccess: (_saved, { productId }) => invalidateModel(qc, productId),
  });
}

export function useDeleteIotService() {
  return useApiMutation(iotProductContract.removeService, {
    invalidate: (qc, _data, { params }) => invalidateModel(qc, params.id),
  });
}

export function useSaveIotEvent() {
  const qc = useQueryClient();
  return useMutation<IotProductEvent, Error, IotModelSaveVars<CreateIotEventInput>>({
    mutationFn: ({ productId, id, values }) => (id === undefined
      ? api(iotProductContract.createEvent, { params: { id: productId }, body: values as CreateIotEventInput })
      : api(iotProductContract.updateEvent, { params: { id: productId, eventId: id }, body: values })),
    onSuccess: (_saved, { productId }) => invalidateModel(qc, productId),
  });
}

export function useDeleteIotEvent() {
  return useApiMutation(iotProductContract.removeEvent, {
    invalidate: (qc, _data, { params }) => invalidateModel(qc, params.id),
  });
}

export function useImportIotTsl() {
  return useApiMutation(iotProductContract.importModel, {
    invalidate: (qc, _saved, { params }) => invalidateModel(qc, params.id),
  });
}
