import type { PaymentFeeRule } from '@zenith/shared/payment';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentFeeRuleListParams extends CrudListParams {
  channel?: string;
  status?: string;
}

export const {
  keys: paymentFeeKeys,
  useList: usePaymentFeeRuleList,
  useSave: useSavePaymentFeeRule,
  useDelete: useDeletePaymentFeeRule,
} = createCrudQueries<PaymentFeeRule, PaymentFeeRuleListParams>({
  resource: 'payment-fee',
  path: '/api/payment/fee-rules',
  deleteMode: 'single',
});
