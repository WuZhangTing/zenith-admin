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
    ['/api/payment', paymentRoutes, { feature: 'payment' }],
    ['/api/payment/recon', paymentReconRoutes, { feature: 'payment' }],
    ['/api/payment/webhooks', paymentWebhookRoutes, { feature: 'payment' }],
    ['/api/payment/ledger', paymentLedgerRoutes, { feature: 'payment' }],
    ['/api/payment/ops', paymentOpsRoutes, { feature: 'payment' }],
    ['/api/payment/fee-rules', paymentFeeRoutes, { feature: 'payment' }],
    ['/api/payment/settlements', paymentSettlementRoutes, { feature: 'payment' }],
    ['/api/payment/sharing', paymentSharingRoutes, { feature: 'payment' }],
    ['/api/payment/transfers', paymentTransferRoutes, { feature: 'payment' }],
    ['/api/payment/apps', paymentAppRoutes, { feature: 'payment' }],
    ['/api/payment/links', paymentLinkRoutes, { feature: 'payment' }],
    ['/api/payment/risk-rules', paymentRiskRoutes, { feature: 'payment' }],
    ['/api/payment/methods', paymentMethodRoutes, { feature: 'payment' }],
    ['/api/payment/reports', paymentReportRoutes, { feature: 'payment' }],
    ['/api/payment/disputes', paymentDisputeRoutes, { feature: 'payment' }],
    ['/api/payment/risk', paymentRiskOpsRoutes, { feature: 'payment' }],
    ['/api/payment/accounts', paymentAccountRoutes, { feature: 'payment' }],
    ['/api/payment/preauths', paymentPreauthRoutes, { feature: 'payment' }],
    ['/api/payment', paymentContractRoutes, { feature: 'payment' }],
    ['/api/public/payment/notify', paymentPublicRoutes],
    ['/api/public/payment/link', paymentLinkPublicRoutes],
    ['/api/biz/pay-demos', bizPayDemoRoutes, { feature: 'payment' }],
  ],
});
