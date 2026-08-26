/**
 * 会员端推送设备绑定（/api/member/push/devices,memberAuthMiddleware 鉴权）。
 * 与管理端共用 routes/ops/push-devices.ts 的路由工厂,主体为 member。
 */
import { memberAuthMiddleware } from '../../middleware/member-auth';
import { currentMemberId } from '../../lib/member-context';
import { createDeviceBindRouter } from '../ops/push-devices';

export default createDeviceBindRouter({
  subjectType: 'member',
  authMiddleware: memberAuthMiddleware,
  resolveSubjectId: () => currentMemberId(),
  tagName: '会员推送',
});
