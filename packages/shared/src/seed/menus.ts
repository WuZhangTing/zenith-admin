import type { Menu } from '../identity/types';
import { SEED_MENUS_COMMON } from './menus/common';
import { SEED_MENUS_SYSTEM } from './menus/system';
import { SEED_MENUS_SETTINGS } from './menus/settings';
import { SEED_MENUS_AI } from './menus/ai';
import { SEED_MENUS_WORKFLOW } from './menus/workflow';
import { SEED_MENUS_MESSAGING } from './menus/messaging';
import { SEED_MENUS_RULES } from './menus/rules';
import { SEED_MENUS_ANALYTICS } from './menus/analytics';
import { SEED_MENUS_PAYMENT } from './menus/payment';
import { SEED_MENUS_MEMBER } from './menus/member';
import { SEED_MENUS_MP } from './menus/mp';
import { SEED_MENUS_BIZ } from './menus/biz';
import { SEED_MENUS_REPORT } from './menus/report';
import { SEED_MENUS_OPEN_PLATFORM } from './menus/open-platform';
import { SEED_MENUS_CMS } from './menus/cms';

export { SEED_DATE } from './_base';

/**
 * 菜单种子数据 —— 按一级目录 ID 段分片维护（见 ./menus/）。
 *
 * 新增模块时只改对应段的分片文件，不要在本文件堆积条目：
 *   系统管理 1000 / 系统设置 2000 / 智能助手 3000 / 工作流 4000 / 消息中心 5000 /
 *   规则中心 6000 / 数据分析 7000 / 支付中心 8000 / 会员中心 9000 / 公众号 10000 /
 *   业务示例 11000 / 报表中心 12000 / 开放平台 13000 / CMS 14000
 *
 * 数组顺序即菜单落库顺序，调整分片顺序会影响 SEED_MENUS 的相对次序。
 */
export const SEED_MENUS: Menu[] = [
  ...SEED_MENUS_COMMON,
  ...SEED_MENUS_SYSTEM,
  ...SEED_MENUS_SETTINGS,
  ...SEED_MENUS_AI,
  ...SEED_MENUS_WORKFLOW,
  ...SEED_MENUS_MESSAGING,
  ...SEED_MENUS_RULES,
  ...SEED_MENUS_ANALYTICS,
  ...SEED_MENUS_PAYMENT,
  ...SEED_MENUS_MEMBER,
  ...SEED_MENUS_MP,
  ...SEED_MENUS_BIZ,
  ...SEED_MENUS_REPORT,
  ...SEED_MENUS_OPEN_PLATFORM,
  ...SEED_MENUS_CMS,
];

// ─── 菜单派生工具（基于 SEED_MENUS 结构化推导，避免硬编码 ID 漂移）───────────────

/** 收集某菜单节点的整棵子树 ID（含自身） */
export function collectMenuSubtreeIds(rootId: number): number[] {
  const childrenByParent = new Map<number, number[]>();
  for (const m of SEED_MENUS) {
    const list = childrenByParent.get(m.parentId) ?? [];
    list.push(m.id);
    childrenByParent.set(m.parentId, list);
  }
  const result: number[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

/** CMS 明细导出（raw export）按钮：按权限码推导，非超管演示角色排除 */
const CMS_RAW_EXPORT_PERMISSIONS: readonly string[] = [
  'cms:subscription:export-raw',
  'cms:ad-event:export-raw',
  'cms:interaction:export-raw',
];

export const CMS_ROOT_MENU_ID = 14000;

export const CMS_RAW_EXPORT_MENU_IDS: number[] = SEED_MENUS
  .filter((m) => m.permission !== undefined && CMS_RAW_EXPORT_PERMISSIONS.includes(m.permission))
  .map((m) => m.id);
