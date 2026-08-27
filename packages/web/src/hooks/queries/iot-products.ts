import type { IotProduct } from '@zenith/shared/iot';
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
