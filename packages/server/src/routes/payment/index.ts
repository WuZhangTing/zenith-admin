import { defineRouteDomain } from '../_kit';
import bizPayDemoRoutes from './biz-pay-demo';
import paymentAccountRoutes from './payment-accounts';
import paymentAppRoutes from './payment-apps';
import paymentContractRoutes from './payment-contracts';
import paymentDisputeRoutes from './payment-disputes';
import paymentFeeRoutes from './payment-fee';
import paymentLedgerRoutes from './payment-ledger';
import paymentLinkPublicRoutes from './payment-link-public';
import paymentLinkRoutes from './payment-links';
import paymentMethodRoutes from './payment-methods';
import paymentOpsRoutes from './payment-ops';
import paymentPreauthRoutes from './payment-preauths';
import paymentPublicRoutes from './payment-public';
import paymentReconRoutes from './payment-recon';
import paymentReportRoutes from './payment-reports';
import paymentRiskOpsRoutes from './payment-risk-ops';
import paymentRiskRoutes from './payment-risk';
import paymentRoutes from './payment';
import paymentSettlementRoutes from './payment-settlements';
import paymentSharingRoutes from './payment-sharing';
import paymentTransferRoutes from './payment-transfers';
import paymentWebhookRoutes from './payment-webhooks';

export default defineRouteDomain({
  name: 'payment',
  mounts: () => [
    ['/api/payment', paymentRoutes],
    ['/api/payment/recon', paymentReconRoutes],
    ['/api/payment/webhooks', paymentWebhookRoutes],
    ['/api/payment/ledger', paymentLedgerRoutes],
    ['/api/payment/ops', paymentOpsRoutes],
    ['/api/payment/fee-rules', paymentFeeRoutes],
    ['/api/payment/settlements', paymentSettlementRoutes],
    ['/api/payment/sharing', paymentSharingRoutes],
    ['/api/payment/transfers', paymentTransferRoutes],
    ['/api/payment/apps', paymentAppRoutes],
    ['/api/payment/links', paymentLinkRoutes],
    ['/api/payment/risk-rules', paymentRiskRoutes],
    ['/api/payment/methods', paymentMethodRoutes],
    ['/api/payment/reports', paymentReportRoutes],
    ['/api/payment/disputes', paymentDisputeRoutes],
    ['/api/payment/risk', paymentRiskOpsRoutes],
    ['/api/payment/accounts', paymentAccountRoutes],
    ['/api/payment/preauths', paymentPreauthRoutes],
    ['/api/payment', paymentContractRoutes],
    ['/api/public/payment/notify', paymentPublicRoutes],
    ['/api/public/payment/link', paymentLinkPublicRoutes],
    ['/api/biz/pay-demos', bizPayDemoRoutes],
  ],
});
