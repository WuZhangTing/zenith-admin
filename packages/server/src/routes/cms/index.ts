import { defineRouteDomain } from '../_kit';
import cmsAdsRoutes from './ads';
import cmsChannelsRoutes from './channels';
import cmsCollectRoutes from './collect';
import cmsCommentsRoutes from './comments';
import cmsContentsRoutes from './contents';
import cmsDashboardRoutes from './dashboard';
import cmsDistributionRoutes from './distributions';
import cmsErrorProneWordsRoutes from './error-prone-words';
import cmsFormsRoutes from './forms';
import cmsFriendLinksRoutes from './friend-links';
import cmsInteractionsRoutes from './interactions';
import cmsModelsRoutes from './models';
import cmsPagesRoutes from './pages';
import cmsPublishingRoutes from './publishing';
import cmsResourcesRoutes from './resources';
import cmsSearchRoutes from './search';
import cmsSensitiveWordsRoutes from './sensitive-words';
import cmsSeoRoutes from './seo';
import cmsSitesRoutes from './sites';
import cmsStaticRoutes from './static';
import cmsStatsRoutes from './stats';
import cmsSubscriptionsRoutes from './subscriptions';
import cmsTagsRoutes from './tags';
import cmsUploadRoutes from './upload';
import cmsWidgetsRoutes from './widgets';
import { createCmsFrontPublicRoutes } from './front-public';
import { createCmsFrontendRoutes } from './frontend';

export default defineRouteDomain({
  name: 'cms',
  mounts: () => [
    ['/api/cms/sites', cmsSitesRoutes],
    ['/api/cms/models', cmsModelsRoutes],
    ['/api/cms/channels', cmsChannelsRoutes],
    ['/api/cms/contents', cmsContentsRoutes],
    ['/api/cms/tags', cmsTagsRoutes],
    ['/api/cms/friend-links', cmsFriendLinksRoutes],
    ['/api/cms/static', cmsStaticRoutes],
    ['/api/cms/search', cmsSearchRoutes],
    ['/api/cms/seo', cmsSeoRoutes],
    ['/api/cms/comments', cmsCommentsRoutes],
    ['/api/cms/ads', cmsAdsRoutes],
    ['/api/cms/forms', cmsFormsRoutes],
    ['/api/cms/sensitive-words', cmsSensitiveWordsRoutes],
    ['/api/cms/error-prone-words', cmsErrorProneWordsRoutes],
    ['/api/cms/interactions', cmsInteractionsRoutes],
    ['/api/cms/stats', cmsStatsRoutes],
    ['/api/cms/collect', cmsCollectRoutes],
    ['/api/cms/pages', cmsPagesRoutes],
    ['/api/cms/widgets', cmsWidgetsRoutes],
    ['/api/cms/dashboard', cmsDashboardRoutes],
    ['/api/cms/publishing', cmsPublishingRoutes],
    ['/api/cms/distributions', cmsDistributionRoutes],
    ['/api/cms/resources', cmsResourcesRoutes],
    ['/api/cms/subscriptions', cmsSubscriptionsRoutes],
    ['/api/cms', cmsUploadRoutes],
    ['/api/public/cms', createCmsFrontPublicRoutes()],
  ],
  // 在全部域的 mounts 之后兜底注册
  fallback: () => [
    ['/', createCmsFrontendRoutes()],
  ],
});
