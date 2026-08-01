import type { Menu } from '@zenith/shared/identity';
import type { InAppMessage, Announcement } from '@zenith/shared/messaging';
import { renderLucideIcon } from '@/utils/icons';

export function getMenuIcon(iconName?: string): React.ReactNode {
  const icon = renderLucideIcon(iconName ?? 'LayoutGrid') ?? renderLucideIcon('LayoutGrid');
  return <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>;
}

// 提取为模块级函数，避免组件内嵌套函数超过 4 层
export const updateMessageRead = (id: number) => (prev: InAppMessage[]) =>
  prev.map((m) => (m.id === id ? { ...m, isRead: true } : m));
export const updateMessageReadIfUnread = (id: number) => (prev: InAppMessage[]) =>
  prev.map((m) => (m.id === id && !m.isRead ? { ...m, isRead: true } : m));
export const markAllMessagesRead = (prev: InAppMessage[]) =>
  prev.map((m) => (m.isRead ? m : { ...m, isRead: true }));
export const removeMessageById = (id: number) => (prev: InAppMessage[]) =>
  prev.filter((m) => m.id !== id);
export const markAnnouncementRead = (id: number) => (prev: (Announcement & { isRead: boolean })[]) =>
  prev.map((a) => (a.id === id ? { ...a, isRead: true } : a));

export type NavItem = {
  itemKey: string;
  text: React.ReactNode;
  icon?: React.ReactNode;
  items?: NavItem[];
  badge?: { count: number; overflowCount?: number };
  isExternal?: boolean;
  /** 菜单配置的默认路由参数（querystring，不含 `?`），跳转时拼接到 path */
  query?: string | null;
};

export function menuToNavItem(menu: Menu): NavItem | null {
  if (!menu.visible || menu.type === 'button') return null;
  const icon = getMenuIcon(menu.icon);
  if (menu.type === 'directory') {
    const children = (menu.children ?? [])
      .map(menuToNavItem)
      .filter((item): item is NavItem => item !== null);
    return { itemKey: menu.name ?? `dir-${menu.id}`, text: menu.title, icon, items: children };
  }
  // 外链内嵌：转为内部路由 /embed/{id}，走正常导航（iframe 打开）；非内嵌外链保持新窗口
  if (menu.isExternal && menu.embed) {
    return { itemKey: `/embed/${menu.id}`, text: menu.title, icon, isExternal: false };
  }
  return { itemKey: menu.path ?? `menu-${menu.id}`, text: menu.title, icon, isExternal: menu.isExternal ?? false, query: menu.query ?? null };
}

export function findNavItemAncestorKeys(items: NavItem[], targetKey: string): string[] | null {
  for (const item of items) {
    if (item.itemKey === targetKey) return [];
    if (item.items?.length) {
      const found = findNavItemAncestorKeys(item.items, targetKey);
      if (found !== null) return [item.itemKey, ...found];
    }
  }
  return null;
}

// 返回 null 表示路径不在菜单树中（如详情页）；返回 [] 表示命中顶级菜单项（无祖先目录）
export function findAncestorKeys(menuTree: Menu[], targetPath: string): string[] | null {
  function traverse(nodes: Menu[], ancestors: string[]): string[] | null {
    for (const node of nodes) {
      if (!node.visible || node.type === 'button') continue;
      if (node.type === 'directory') {
        const key = node.name ?? `dir-${node.id}`;
        const found = traverse(node.children ?? [], [...ancestors, key]);
        if (found !== null) return found;
      } else if (node.path === targetPath) {
        return ancestors;
      }
    }
    return null;
  }
  return traverse(menuTree, []);
}

export interface BreadcrumbData {
  title: string;
  path?: string;
  icon?: string;
  menuChildren?: Menu[];
}

export function findFirstLeafPath(children: Menu[]): string | null {
  for (const child of children) {
    if (!child.visible || child.type === 'button') continue;
    if (child.type === 'directory') {
      const leaf = findFirstLeafPath(child.children ?? []);
      if (leaf) return leaf;
    } else if (child.path) {
      return child.path;
    }
  }
  return null;
}

export function findBreadcrumbs(menuTree: Menu[], targetPath: string): BreadcrumbData[] {
  function traverse(nodes: Menu[], ancestors: BreadcrumbData[]): BreadcrumbData[] | null {
    for (const node of nodes) {
      if (!node.visible || node.type === 'button') continue;
      if (node.type === 'directory') {
        const found = traverse(node.children ?? [], [...ancestors, { title: node.title, icon: node.icon ?? undefined, menuChildren: node.children ?? [] }]);
        if (found !== null) return found;
      } else if (node.path === targetPath) {
        return [...ancestors, { title: node.title, path: node.path ?? undefined, icon: node.icon ?? undefined }];
      }
    }
    return null;
  }
  return traverse(menuTree, []) ?? [];
}
