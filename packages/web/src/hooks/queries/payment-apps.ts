import type { PaymentApp } from '@zenith/shared/payment';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentAppListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: paymentAppKeys,
  useList: usePaymentAppList,
  useSave: useSavePaymentApp,
  useDelete: useDeletePaymentApp,
} = createCrudQueries<PaymentApp, PaymentAppListParams>({
  resource: 'payment-apps',
  path: '/api/payment/apps',
  deleteMode: 'single',
});
