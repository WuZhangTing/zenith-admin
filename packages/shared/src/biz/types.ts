import type { PaymentMethod } from '../payment/constants';

// ─── 业务接入示例：支付接入（演示业务模块如何对接支付中心）─────────────────────
export type BizPayDemoStatus = 'pending' | 'paying' | 'paid' | 'closed';

export interface BizPayDemo {
  id: number;
  /** 示例事项 / 商品名称 */
  subject: string;
  /** 金额（分） */
  amount: number;
  /** 发起支付时记录的支付方式（下单前为 null） */
  payMethod: PaymentMethod | null;
  status: BizPayDemoStatus;
  /** 关联支付中心订单号（发起支付后回填） */
  paymentOrderNo: string | null;
  /** 支付成功时间 YYYY-MM-DD HH:mm:ss */
  paidAt: string | null;
  /** 履约备注（支付成功后自动发放示例权益） */
  fulfillRemark: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}
