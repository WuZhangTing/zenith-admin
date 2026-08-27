import { defineRouteDomain } from '../_kit';
import marketingCampaignsRoutes from './marketing-campaigns';
import memberMarketingRoutes from './member-marketing';

export default defineRouteDomain({
  name: 'marketing',
  mounts: () => [
    ['/api/marketing/campaigns', marketingCampaignsRoutes],
    ['/api/member/marketing', memberMarketingRoutes],
  ],
});
