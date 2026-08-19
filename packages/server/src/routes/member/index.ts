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
    ['/api/member/auth', memberAuthRoutes, { feature: 'member' }],
    ['/api/member/renewal', memberRenewalRoutes, { feature: 'member' }],
    ['/api/member/cms', memberCmsRoutes, { feature: 'member' }],
    ['/api/member', memberSelfRoutes, { feature: 'member' }],
    ['/api/members', membersRoutes, { feature: 'member' }],
    ['/api/member-levels', memberLevelsRoutes, { feature: 'member' }],
    ['/api/member-tags', memberTagsRoutes, { feature: 'member' }],
    ['/api/member-points', memberPointsRoutes, { feature: 'member' }],
    ['/api/member-wallets', memberWalletsRoutes, { feature: 'member' }],
    ['/api/coupons', couponsRoutes, { feature: 'member' }],
    ['/api/checkin-rules', checkinRulesRoutes, { feature: 'member' }],
    ['/api/checkin-milestones', checkinMilestonesRoutes, { feature: 'member' }],
    ['/api/checkin-settings', checkinSettingsRoutes, { feature: 'member' }],
    ['/api/member-checkins', memberCheckinsRoutes, { feature: 'member' }],
    ['/api/member-recharges', memberRechargesRoutes, { feature: 'member' }],
    ['/api/member-stats', memberStatsRoutes, { feature: 'member' }],
  ],
});
