import { defineRouteDomain } from '../_kit';
import shortLinksRoutes from './short-links';
import redirectRoutes from './redirect';

export default defineRouteDomain({
  name: 'short-link',
  mounts: () => [
    ['/api/short-links', shortLinksRoutes],
    // 公开跳转入口：mounts 先于所有域的 fallback（CMS 前台 SSR）注册，/s 前缀不会被吞掉
    ['/s', redirectRoutes],
  ],
});
