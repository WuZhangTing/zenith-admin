import type { PaymentMethod } from '../payment/constants';
import type { WorkflowInstanceStatus } from '../workflow/types';

// ─── 业务接入示例：请假（业务模块自有实体，通过 businessKey 关联工作流）────────────
export type BizLeaveStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface BizLeave {
  id: number;
  /** 请假类型：annual=年假, sick=病假, personal=事假, marriage=婚假, other=其他 */
  leaveType: string;
  /** 开始日期 YYYY-MM-DD */
  startDate: string;
  /** 结束日期 YYYY-MM-DD */
  endDate: string;
  days: number;
  reason: string | null;
  status: BizLeaveStatus;
  /** 关联的工作流实例 ID（提交审批后回填） */
  workflowInstanceId: number | null;
  /** 冗余的工作流状态，便于列表展示 */
  workflowStatus: WorkflowInstanceStatus | null;
  /** 申请人（= createdBy） */
  applicantId: number | null;
  applicantName?: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

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
