import { defineRouteDomain } from '../_kit';
import mpAccountsRoutes from './mp-accounts';
import mpAutoRepliesRoutes from './mp-auto-replies';
import mpBroadcastsRoutes from './mp-broadcasts';
import mpCallbackRoutes from './mp-callback';
import mpConditionalMenuRoutes from './mp-conditional-menus';
import mpDraftsRoutes from './mp-drafts';
import mpFansRoutes from './mp-fans';
import mpJsSdkRoutes from './mp-jssdk';
import mpKfRoutes from './mp-kf';
import mpKfSessionRoutes from './mp-kf-sessions';
import mpMaterialsRoutes from './mp-materials';
import mpMenuRoutes from './mp-menu';
import mpMessagesRoutes from './mp-messages';
import mpOAuthPublicRoutes from './mp-oauth-public';
import mpOAuthRoutes from './mp-oauth';
import mpQrcodesRoutes from './mp-qrcodes';
import mpSecurityRoutes from './mp-security';
import mpStatsRoutes from './mp-stats';
import mpTagsRoutes from './mp-tags';
import mpTemplatesRoutes from './mp-templates';

export default defineRouteDomain({
  name: 'mp',
  mounts: () => [
    ['/api/public/mp/callback', mpCallbackRoutes],
    ['/api/public/mp/oauth', mpOAuthPublicRoutes],
    ['/api/mp/accounts', mpAccountsRoutes, { feature: 'mp' }],
    ['/api/mp/tags', mpTagsRoutes, { feature: 'mp' }],
    ['/api/mp/fans', mpFansRoutes, { feature: 'mp' }],
    ['/api/mp/messages', mpMessagesRoutes, { feature: 'mp' }],
    ['/api/mp/auto-replies', mpAutoRepliesRoutes, { feature: 'mp' }],
    ['/api/mp/menu', mpMenuRoutes, { feature: 'mp' }],
    ['/api/mp/materials', mpMaterialsRoutes, { feature: 'mp' }],
    ['/api/mp/drafts', mpDraftsRoutes, { feature: 'mp' }],
    ['/api/mp/templates', mpTemplatesRoutes, { feature: 'mp' }],
    ['/api/mp/stats', mpStatsRoutes, { feature: 'mp' }],
    ['/api/mp/broadcasts', mpBroadcastsRoutes, { feature: 'mp' }],
    ['/api/mp/qrcodes', mpQrcodesRoutes, { feature: 'mp' }],
    ['/api/mp/oauth', mpOAuthRoutes, { feature: 'mp' }],
    ['/api/mp/kf-accounts', mpKfRoutes, { feature: 'mp' }],
    ['/api/mp/kf-sessions', mpKfSessionRoutes, { feature: 'mp' }],
    ['/api/mp/conditional-menus', mpConditionalMenuRoutes, { feature: 'mp' }],
    ['/api/mp/security', mpSecurityRoutes, { feature: 'mp' }],
    ['/api/mp/jssdk', mpJsSdkRoutes, { feature: 'mp' }],
  ],
});
