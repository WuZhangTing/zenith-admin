import { defineRouteDomain } from '../_kit';
import bizLeaveRoutes from './biz-leave';

export default defineRouteDomain({
  name: 'biz-demo',
  mounts: () => [
    ['/api/biz/leaves', bizLeaveRoutes],
  ],
});
