import { defineRouteDomain } from '../_kit';
import wikiSpacesRoutes from './wiki-spaces';
import wikiDocsRoutes from './wiki-docs';
import wikiTemplatesRoutes from './wiki-templates';
import wikiTagsRoutes from './wiki-tags';
import wikiCommentsRoutes from './wiki-comments';
import wikiStatsRoutes, { settingsRouter as wikiSettingsRoutes } from './wiki-stats';

export default defineRouteDomain({
  name: 'wiki',
  mounts: () => [
    ['/api/wiki/spaces', wikiSpacesRoutes],
    ['/api/wiki/docs', wikiDocsRoutes],
    ['/api/wiki/templates', wikiTemplatesRoutes],
    ['/api/wiki/tags', wikiTagsRoutes],
    ['/api/wiki/comments', wikiCommentsRoutes],
    ['/api/wiki/stats', wikiStatsRoutes],
    ['/api/wiki/settings', wikiSettingsRoutes],
  ],
});
