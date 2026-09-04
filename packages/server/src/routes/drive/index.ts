import { defineRouteDomain } from '../_kit';
import driveSpacesRoutes from './drive-spaces';
import driveNodesRoutes from './drive-nodes';
import driveNodeItemRoutes from './drive-node-item';
import driveShareLinksRoutes from './drive-share-links';
import drivePublicRoutes from './drive-public';
import driveTagsRoutes from './drive-tags';
import driveAdminRoutes from './drive-admin';

export default defineRouteDomain({
  name: 'drive',
  mounts: () => [
    ['/api/drive/spaces', driveSpacesRoutes, { feature: 'drive' }],
    // 静态路径路由器先于单节点 /{id} 路由器挂载在同一路径
    ['/api/drive/nodes', driveNodesRoutes, { feature: 'drive' }],
    ['/api/drive/nodes', driveNodeItemRoutes, { feature: 'drive' }],
    ['/api/drive/share-links', driveShareLinksRoutes, { feature: 'drive' }],
    ['/api/drive/tags', driveTagsRoutes, { feature: 'drive' }],
    ['/api/drive/admin', driveAdminRoutes, { feature: 'drive' }],
    // 外链匿名访问：feature 门禁同样生效（关闭网盘功能即整体不可达）
    ['/api/drive/public', drivePublicRoutes, { feature: 'drive' }],
  ],
});
