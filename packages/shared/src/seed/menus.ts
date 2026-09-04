import type { Menu } from '../identity/types';
import { MENU_ROOT_FEATURE_MAP } from '../licensing/feature-catalog';
import { SEED_MENUS_COMMON } from './menus/common';
import { SEED_MENUS_SYSTEM } from './menus/system';
import { SEED_MENUS_SETTINGS } from './menus/settings';
import { SEED_MENUS_ALERTS } from './menus/alerts';
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
import { SEED_MENUS_WIKI } from './menus/wiki';
import { SEED_MENUS_GROWTH } from './menus/growth';
import { SEED_MENUS_IOT } from './menus/iot';
import { SEED_MENUS_DRIVE } from './menus/drive';

export { SEED_DATE } from './_base';

/**
 * 菜单种子数据 —— 按一级目录 ID 段分片维护（见 ./menus/）。
 *
 * 新增模块时只改对应段的分片文件，不要在本文件堆积条目：
 *   系统管理 1000 / 系统设置 2000 / 智能助手 3000 / 工作流 4000 / 消息中心 5000 /
 *   规则中心 6000 / 数据分析 7000 / 支付中心 8000 / 会员中心 9000 / 公众号 10000 /
 *   业务示例 11000 / 报表中心 12000 / 开放平台 13000 / CMS 14000 / 告警中心 15000 /
 *   知识中心 16000 / 运营中心 17000 / IoT 18000 / 企业网盘 19000
 *
 * 数组顺序即菜单落库顺序，调整分片顺序会影响 SEED_MENUS 的相对次序。
 */
export const SEED_MENUS: Menu[] = applyMenuFeatureKeys([
  ...SEED_MENUS_COMMON,
  ...SEED_MENUS_SYSTEM,
  ...SEED_MENUS_SETTINGS,
  ...SEED_MENUS_ALERTS,
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
  ...SEED_MENUS_WIKI,
  ...SEED_MENUS_GROWTH,
  ...SEED_MENUS_IOT,
  ...SEED_MENUS_DRIVE,
]);

/**
 * 按功能目录的 menuRoots 为整棵子树派生 featureKey。
 * featureKey 为 null 的菜单属于核心能力（不可关闭）；分片文件无需逐行标注，
 * 目录（@zenith/shared/licensing 的 LICENSE_FEATURE_CATALOG）是唯一事实源。
 */
function applyMenuFeatureKeys(menus: Menu[]): Menu[] {
  const childrenByParent = new Map<number, Menu[]>();
  for (const m of menus) {
    const list = childrenByParent.get(m.parentId) ?? [];
    list.push(m);
    childrenByParent.set(m.parentId, list);
  }
  const featureById = new Map<number, string>();
  for (const [rootId, featureKey] of MENU_ROOT_FEATURE_MAP) {
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      featureById.set(id, featureKey);
      for (const child of childrenByParent.get(id) ?? []) queue.push(child.id);
    }
  }
  return menus.map((m) => ({ ...m, featureKey: featureById.get(m.id) ?? null }));
}

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

// 知识中心根目录与文档中心页面（供角色种子引用，避免魔法数字散落）
export const WIKI_ROOT_MENU_ID = 16000;
export const WIKI_DOC_CENTER_MENU_ID = 16010;

// 企业网盘根目录与工作台页面（普通用户默认可用个人网盘）
export const DRIVE_ROOT_MENU_ID = 19000;
export const DRIVE_WORKBENCH_MENU_ID = 19010;

export const CMS_RAW_EXPORT_MENU_IDS: number[] = SEED_MENUS
  .filter((m) => m.permission !== undefined && CMS_RAW_EXPORT_PERMISSIONS.includes(m.permission))
  .map((m) => m.id);
