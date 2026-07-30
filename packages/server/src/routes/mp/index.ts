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
    ['/api/mp/accounts', mpAccountsRoutes],
    ['/api/mp/tags', mpTagsRoutes],
    ['/api/mp/fans', mpFansRoutes],
    ['/api/mp/messages', mpMessagesRoutes],
    ['/api/mp/auto-replies', mpAutoRepliesRoutes],
    ['/api/mp/menu', mpMenuRoutes],
    ['/api/mp/materials', mpMaterialsRoutes],
    ['/api/mp/drafts', mpDraftsRoutes],
    ['/api/mp/templates', mpTemplatesRoutes],
    ['/api/mp/stats', mpStatsRoutes],
    ['/api/mp/broadcasts', mpBroadcastsRoutes],
    ['/api/mp/qrcodes', mpQrcodesRoutes],
    ['/api/mp/oauth', mpOAuthRoutes],
    ['/api/mp/kf-accounts', mpKfRoutes],
    ['/api/mp/kf-sessions', mpKfSessionRoutes],
    ['/api/mp/conditional-menus', mpConditionalMenuRoutes],
    ['/api/mp/security', mpSecurityRoutes],
    ['/api/mp/jssdk', mpJsSdkRoutes],
  ],
});
