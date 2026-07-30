import { defineRouteDomain } from '../_kit';
import checkinMilestonesRoutes from './checkin-milestones';
import checkinRulesRoutes from './checkin-rules';
import checkinSettingsRoutes from './checkin-settings';
import couponsRoutes from './coupons';
import memberAuthRoutes from './member-auth';
import memberCheckinsRoutes from './member-checkins';
import memberCmsRoutes from './member-cms';
import memberLevelsRoutes from './member-levels';
import memberPointsRoutes from './member-points';
import memberRechargesRoutes from './member-recharges';
import memberRenewalRoutes from './member-renewal';
import memberSelfRoutes from './member-self';
import memberStatsRoutes from './member-stats';
import memberTagsRoutes from './member-tags';
import memberWalletsRoutes from './member-wallets';
import membersRoutes from './members';

export default defineRouteDomain({
  name: 'member',
  mounts: () => [
    ['/api/member/auth', memberAuthRoutes],
    ['/api/member/renewal', memberRenewalRoutes],
    ['/api/member/cms', memberCmsRoutes],
    ['/api/member', memberSelfRoutes],
    ['/api/members', membersRoutes],
    ['/api/member-levels', memberLevelsRoutes],
    ['/api/member-tags', memberTagsRoutes],
    ['/api/member-points', memberPointsRoutes],
    ['/api/member-wallets', memberWalletsRoutes],
    ['/api/coupons', couponsRoutes],
    ['/api/checkin-rules', checkinRulesRoutes],
    ['/api/checkin-milestones', checkinMilestonesRoutes],
    ['/api/checkin-settings', checkinSettingsRoutes],
    ['/api/member-checkins', memberCheckinsRoutes],
    ['/api/member-recharges', memberRechargesRoutes],
    ['/api/member-stats', memberStatsRoutes],
  ],
});
