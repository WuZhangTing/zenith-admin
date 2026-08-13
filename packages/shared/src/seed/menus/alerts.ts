import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 告警中心（15000 段） */
export const SEED_MENUS_ALERTS: Menu[] = [
  { id: 15000, parentId: 0, title: '告警中心', name: 'AlertCenter', icon: 'BellRing', type: 'directory', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15030, parentId: 15000, title: '告警概览', name: 'AlertOverview', path: '/alerts/overview', component: 'alerts/overview/AlertOverviewPage', icon: 'LayoutDashboard', type: 'menu', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15031, parentId: 15030, title: '查询', type: 'button', permission: 'alert:overview:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15010, parentId: 15000, title: '告警规则', name: 'AlertRules', path: '/alerts/rules', component: 'alerts/rules/AlertRulesPage', icon: 'Siren', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15011, parentId: 15010, title: '查询', type: 'button', permission: 'alert:rule:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15012, parentId: 15010, title: '新增规则', type: 'button', permission: 'alert:rule:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15013, parentId: 15010, title: '编辑规则', type: 'button', permission: 'alert:rule:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15014, parentId: 15010, title: '删除规则', type: 'button', permission: 'alert:rule:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15015, parentId: 15010, title: '试发通知', type: 'button', permission: 'alert:rule:test', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15020, parentId: 15000, title: '告警事件', name: 'AlertEvents', path: '/alerts/events', component: 'alerts/events/AlertEventsPage', icon: 'History', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15021, parentId: 15020, title: '查询', type: 'button', permission: 'alert:event:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15022, parentId: 15020, title: '导出', type: 'button', permission: 'alert:event:export', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 15023, parentId: 15020, title: '处理告警', type: 'button', permission: 'alert:event:handle', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
