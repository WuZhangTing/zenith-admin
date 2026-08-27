import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 运营中心（17000 段）—— 短链服务等增长运营工具的归属目录 */
export const SEED_MENUS_GROWTH: Menu[] = [
  { id: 17000, parentId: 0, title: '运营中心', name: 'GrowthCenter', icon: 'Megaphone', type: 'directory', sort: 17, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 短链管理 ──────────────────────────────────────────────────────────────
  { id: 17010, parentId: 17000, title: '短链管理', name: 'GrowthShortLinks', path: '/growth/short-links', component: 'short-link/ShortLinksPage', icon: 'Link2', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17011, parentId: 17010, title: '查询', type: 'button', permission: 'shortlink:link:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17012, parentId: 17010, title: '新增短链', type: 'button', permission: 'shortlink:link:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17013, parentId: 17010, title: '编辑短链', type: 'button', permission: 'shortlink:link:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17014, parentId: 17010, title: '删除短链', type: 'button', permission: 'shortlink:link:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17015, parentId: 17010, title: '导出', type: 'button', permission: 'shortlink:link:export', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17016, parentId: 17010, title: '访问统计', type: 'button', permission: 'shortlink:stats:view', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 渠道推广分析 ──────────────────────────────────────────────────────────
  { id: 17030, parentId: 17000, title: '渠道分析', name: 'GrowthChannelAnalysis', path: '/growth/channel-analysis', component: 'short-link/ChannelAnalysisPage', icon: 'TrendingUp', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 17031, parentId: 17030, title: '查询', type: 'button', permission: 'shortlink:analysis:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
