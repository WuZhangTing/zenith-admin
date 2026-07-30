import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 数据分析（7000 段） */
export const SEED_MENUS_ANALYTICS: Menu[] = [
  { id: 7000, parentId: 0, title: '数据分析', name: 'Analytics', icon: 'BarChart2', type: 'directory', sort: 8, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7010, parentId: 7000, title: '行为分析', name: 'AnalyticsBehavior', path: '/analytics/behavior', component: 'analytics/AnalyticsPage', icon: 'Activity', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7011, parentId: 7010, title: '查询', type: 'button', permission: 'analytics:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7020, parentId: 7000, title: '数据管理', name: 'AnalyticsData', path: '/analytics/data', component: 'analytics/AnalyticsDataPage', icon: 'Database', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7021, parentId: 7020, title: '查询', type: 'button', permission: 'analytics:manage', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7022, parentId: 7020, title: '清除数据', type: 'button', permission: 'analytics:clean', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7023, parentId: 7020, title: '导出数据', type: 'button', permission: 'analytics:export', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7030, parentId: 7000, title: '错误监控', name: 'FrontendErrors', path: '/analytics/errors', component: 'analytics/FrontendErrorsPage', icon: 'AlertCircle', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7031, parentId: 7030, title: '查询', type: 'button', permission: 'monitor:error:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7032, parentId: 7030, title: '清除错误', type: 'button', permission: 'monitor:error:manage', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7033, parentId: 7030, title: '告警查看', type: 'button', permission: 'monitor:alert:list', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7034, parentId: 7030, title: '告警管理', type: 'button', permission: 'monitor:alert:manage', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 支付中心（8000 段）
];
