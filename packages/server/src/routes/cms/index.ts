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
    ['/api/cms/sites', cmsSitesRoutes, { feature: 'cms' }],
    ['/api/cms/models', cmsModelsRoutes, { feature: 'cms' }],
    ['/api/cms/channels', cmsChannelsRoutes, { feature: 'cms' }],
    ['/api/cms/contents', cmsContentsRoutes, { feature: 'cms' }],
    ['/api/cms/tags', cmsTagsRoutes, { feature: 'cms' }],
    ['/api/cms/friend-links', cmsFriendLinksRoutes, { feature: 'cms' }],
    ['/api/cms/static', cmsStaticRoutes, { feature: 'cms' }],
    ['/api/cms/search', cmsSearchRoutes, { feature: 'cms' }],
    ['/api/cms/seo', cmsSeoRoutes, { feature: 'cms' }],
    ['/api/cms/comments', cmsCommentsRoutes, { feature: 'cms' }],
    ['/api/cms/ads', cmsAdsRoutes, { feature: 'cms' }],
    ['/api/cms/forms', cmsFormsRoutes, { feature: 'cms' }],
    ['/api/cms/sensitive-words', cmsSensitiveWordsRoutes, { feature: 'cms' }],
    ['/api/cms/error-prone-words', cmsErrorProneWordsRoutes, { feature: 'cms' }],
    ['/api/cms/interactions', cmsInteractionsRoutes, { feature: 'cms' }],
    ['/api/cms/stats', cmsStatsRoutes, { feature: 'cms' }],
    ['/api/cms/collect', cmsCollectRoutes, { feature: 'cms' }],
    ['/api/cms/pages', cmsPagesRoutes, { feature: 'cms' }],
    ['/api/cms/widgets', cmsWidgetsRoutes, { feature: 'cms' }],
    ['/api/cms/dashboard', cmsDashboardRoutes, { feature: 'cms' }],
    ['/api/cms/publishing', cmsPublishingRoutes, { feature: 'cms' }],
    ['/api/cms/distributions', cmsDistributionRoutes, { feature: 'cms' }],
    ['/api/cms/resources', cmsResourcesRoutes, { feature: 'cms' }],
    ['/api/cms/subscriptions', cmsSubscriptionsRoutes, { feature: 'cms' }],
    ['/api/cms', cmsUploadRoutes, { feature: 'cms' }],
    ['/api/public/cms', createCmsFrontPublicRoutes()],
  ],
  // 在全部域的 mounts 之后兜底注册
  fallback: () => [
    ['/', createCmsFrontendRoutes()],
  ],
});
