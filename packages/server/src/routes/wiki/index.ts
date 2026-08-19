import { defineRouteDomain } from '../_kit';
import wikiSpacesRoutes from './wiki-spaces';
import wikiDocsRoutes from './wiki-docs';
import wikiTemplatesRoutes from './wiki-templates';
import wikiTagsRoutes from './wiki-tags';
import wikiCommentsRoutes from './wiki-comments';
import wikiGovernanceRoutes from './wiki-governance';
import wikiStatsRoutes, { settingsRouter as wikiSettingsRoutes } from './wiki-stats';

export default defineRouteDomain({
  name: 'wiki',
  mounts: () => [
    ['/api/wiki/spaces', wikiSpacesRoutes, { feature: 'wiki' }],
    ['/api/wiki/docs', wikiDocsRoutes, { feature: 'wiki' }],
    ['/api/wiki/templates', wikiTemplatesRoutes, { feature: 'wiki' }],
    ['/api/wiki/tags', wikiTagsRoutes, { feature: 'wiki' }],
    ['/api/wiki/comments', wikiCommentsRoutes, { feature: 'wiki' }],
    ['/api/wiki/stats', wikiStatsRoutes, { feature: 'wiki' }],
    ['/api/wiki/settings', wikiSettingsRoutes, { feature: 'wiki' }],
    ['/api/wiki/governance', wikiGovernanceRoutes, { feature: 'wiki' }],
  ],
});
