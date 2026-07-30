import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 消息中心（5000 段） */
export const SEED_MENUS_MESSAGING: Menu[] = [
  { id: 5000, parentId: 0, title: '消息中心', name: 'ChatCenter', path: '/chat', component: 'chat/ChatPage', icon: 'MessagesSquare', type: 'menu', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 5001, parentId: 5000, title: '导出聊天记录', type: 'button', permission: 'chat:message:export', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 规则中心（6000 段）
];
