import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 知识中心（16000 段） */
export const SEED_MENUS_WIKI: Menu[] = [
  { id: 16000, parentId: 0, title: '知识中心', name: 'WikiCenter', icon: 'BookOpen', type: 'directory', sort: 16, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 文档中心（主工作台）───────────────────────────────────────────────────
  { id: 16010, parentId: 16000, title: '文档中心', name: 'WikiDocCenter', path: '/wiki/docs', component: 'wiki/docs/WikiDocCenterPage', icon: 'BookOpenText', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16011, parentId: 16010, title: '查询', type: 'button', permission: 'wiki:doc:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16012, parentId: 16010, title: '新增文档', type: 'button', permission: 'wiki:doc:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16013, parentId: 16010, title: '编辑文档', type: 'button', permission: 'wiki:doc:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16014, parentId: 16010, title: '删除文档', type: 'button', permission: 'wiki:doc:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16015, parentId: 16010, title: '提交发布', type: 'button', permission: 'wiki:doc:publish', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16016, parentId: 16010, title: '移动文档', type: 'button', permission: 'wiki:doc:move', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // 全屏编辑页与版本对比页：从文档中心跳转进入，不在侧边栏展示
  { id: 16017, parentId: 16010, title: '文档编辑页', name: 'WikiDocEdit', path: '/wiki/docs/edit', component: 'wiki/docs/WikiDocEditPage', icon: 'FilePen', type: 'menu', sort: 8, status: 'enabled', visible: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 16018, parentId: 16010, title: '版本对比页', name: 'WikiDocHistory', path: '/wiki/docs/history', component: 'wiki/docs/WikiDocHistoryPage', icon: 'History', type: 'menu', sort: 9, status: 'enabled', visible: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
