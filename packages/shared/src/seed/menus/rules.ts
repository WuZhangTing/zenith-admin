import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 规则中心（6000 段） */
export const SEED_MENUS_RULES: Menu[] = [
  { id: 6000, parentId: 0, title: '规则中心', name: 'RuleCenter', icon: 'Table2', type: 'directory', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6010, parentId: 6000, title: '决策表', name: 'RuleTables', path: '/rules/tables', component: 'rules/tables/RuleTablesPage', icon: 'Grid3x3', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6011, parentId: 6010, title: '查询', type: 'button', permission: 'rule:table:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6012, parentId: 6010, title: '新增决策表', type: 'button', permission: 'rule:table:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6013, parentId: 6010, title: '编辑决策表', type: 'button', permission: 'rule:table:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6014, parentId: 6010, title: '删除决策表', type: 'button', permission: 'rule:table:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6015, parentId: 6010, title: '发布决策表', type: 'button', permission: 'rule:table:publish', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6016, parentId: 6010, title: '求值测试', type: 'button', permission: 'rule:table:evaluate', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6017, parentId: 6010, title: '审批发布', type: 'button', permission: 'rule:table:approve', sort: 6, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6020, parentId: 6000, title: '决策执行记录', name: 'RuleExecutions', path: '/rules/executions', component: 'rules/executions/RuleExecutionsPage', icon: 'History', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6021, parentId: 6020, title: '查询', type: 'button', permission: 'rule:table:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6030, parentId: 6000, title: '决策流', name: 'RuleFlows', path: '/rules/flows', component: 'rules/flows/RuleFlowsPage', icon: 'GitBranch', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6031, parentId: 6030, title: '查询', type: 'button', permission: 'rule:flow:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6032, parentId: 6030, title: '新增决策流', type: 'button', permission: 'rule:flow:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6033, parentId: 6030, title: '编辑决策流', type: 'button', permission: 'rule:flow:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6034, parentId: 6030, title: '删除决策流', type: 'button', permission: 'rule:flow:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6035, parentId: 6030, title: '发布决策流', type: 'button', permission: 'rule:flow:publish', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6036, parentId: 6030, title: '决策流求值', type: 'button', permission: 'rule:flow:evaluate', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6040, parentId: 6000, title: '名单库', name: 'RuleLists', path: '/rules/lists', component: 'rules/lists/RuleListsPage', icon: 'ShieldBan', type: 'menu', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6041, parentId: 6040, title: '查询', type: 'button', permission: 'rule:list:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6042, parentId: 6040, title: '新增名单', type: 'button', permission: 'rule:list:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6043, parentId: 6040, title: '编辑名单', type: 'button', permission: 'rule:list:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6044, parentId: 6040, title: '删除名单', type: 'button', permission: 'rule:list:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6045, parentId: 6040, title: '条目管理', type: 'button', permission: 'rule:list:item', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 数据分析（7000 段）
];
