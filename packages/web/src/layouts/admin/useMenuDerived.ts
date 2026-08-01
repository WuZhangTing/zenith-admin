import { useCallback, useEffect, useMemo } from 'react';
import type { Menu } from '@zenith/shared/identity';
import type { FlatMenuItem } from '@/components/MenuSearchInput';
import type { NavLayout } from '@/hooks/usePreferences';
import { useLucideIconsReady } from '@/utils/icons';
import { menuToNavItem, findAncestorKeys, findBreadcrumbs, type NavItem, type BreadcrumbData } from './utils';

export function useFlatMenus(menuTree: Menu[]) {
  const flatMenus = useMemo<FlatMenuItem[]>(() => {
    const result: FlatMenuItem[] = [];
    const walk = (nodes: Menu[], parents: string[]) => {
      for (const node of nodes) {
        if (node.type === 'menu' && node.path && node.status === 'enabled' && node.visible) {
          // 外链内嵌菜单的实际访问路径是内部路由 /embed/{id}（页签/搜索/收藏按此匹配）
          const path = node.isExternal && node.embed ? `/embed/${node.id}` : node.path;
          result.push({ id: node.id, title: node.title, path, icon: node.icon, breadcrumb: parents });
        }
        if (node.children?.length) walk(node.children, node.type === 'directory' ? [...parents, node.title] : parents);
      }
    };
    walk(menuTree, []);
    return result;
  }, [menuTree]);
  return flatMenus;
}

export function useBreadcrumbData(menuTree: Menu[], pathname: string, breadcrumbShowHome: boolean | undefined) {
  const currentSectionKeys = useMemo(
    () => findAncestorKeys(menuTree, pathname),
    [menuTree, pathname]
  );

  const breadcrumbs = useMemo(
    () => findBreadcrumbs(menuTree, pathname),
    [menuTree, pathname]
  );
  const displayBreadcrumbs = useMemo<BreadcrumbData[]>(() => {
    if ((breadcrumbShowHome ?? true) && pathname !== '/') {
      // 找到首页菜单的图标（findBreadcrumbs 不包含首页）
      const findHomeIcon = (nodes: Menu[]): string | undefined => {
        for (const node of nodes) {
          if (!node.visible || node.type === 'button') continue;
          if (node.type === 'directory' && node.children?.length) {
            const icon = findHomeIcon(node.children);
            if (icon) return icon;
          } else if (node.path === '/') {
            return node.icon ?? undefined;
          }
        }
        return undefined;
      };
      return [{ title: '首页', path: '/', icon: findHomeIcon(menuTree) }, ...breadcrumbs];
    }
    return breadcrumbs;
  }, [breadcrumbs, breadcrumbShowHome, pathname, menuTree]);

  return { currentSectionKeys, displayBreadcrumbs };
}

export function useNavItems(menuTree: Menu[], chatUnreadCount: number) {
  const iconsReady = useLucideIconsReady();
  const navItems = useMemo(
    () => menuTree.map(menuToNavItem).filter((item): item is NavItem => item !== null).map((item) => {
      if (item.itemKey === '/chat' && chatUnreadCount > 0) {
        return { ...item, badge: { count: chatUnreadCount, overflowCount: 99 } };
      }
      return item;
    }),
    // iconsReady: 图标注册表异步加载完成后重建 nav 项以补齐菜单图标
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menuTree, chatUnreadCount, iconsReady]
  );
  return navItems;
}

export function useMenuMaps(menuTree: Menu[]) {
  const pathTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    function traverse(nodes: Menu[]) {
      for (const node of nodes) {
        if (node.path && node.title) map[node.path] = node.title;
        if (node.children) traverse(node.children);
      }
    }
    traverse(menuTree);
    return map;
  }, [menuTree]);

  const resolveTitle = useCallback((pathname: string) => {
    if (pathTitleMap[pathname]) return pathTitleMap[pathname];
    // 前缀匹配：用于带动态参数的隐藏菜单（如 /workflow/designer → /workflow/designer/1）
    const prefixMatch = Object.entries(pathTitleMap).find(([p]) => pathname.startsWith(p + '/'));
    return prefixMatch ? prefixMatch[1] : pathname;
  }, [pathTitleMap]);

  const pathIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    function traverse(nodes: Menu[]) {
      for (const node of nodes) {
        if (node.path && node.icon) map[node.path] = node.icon;
        if (node.children) traverse(node.children);
      }
    }
    traverse(menuTree);
    return map;
  }, [menuTree]);

  return { resolveTitle, pathIconMap };
}

export function useAutoTopKey(
  navLayout: NavLayout,
  navItems: NavItem[],
  pathname: string,
  setManualTopKey: (key: string | null) => void,
) {
  const autoTopKey = useMemo(() => {
    if (navLayout !== 'mixed' && navLayout !== 'double') return null;
    function contains(items: NavItem[], path: string): boolean {
      return items.some((item) =>
        item.itemKey === path || (item.items ? contains(item.items, path) : false),
      );
    }
    for (const item of navItems) {
      if (contains([item], pathname)) return item.itemKey;
    }
    return navItems[0]?.itemKey ?? null;
  }, [navLayout, navItems, pathname]);

  useEffect(() => {
    if ((navLayout === 'mixed' || navLayout === 'double') && autoTopKey) setManualTopKey(autoTopKey);
  }, [navLayout, autoTopKey, setManualTopKey]);

  return autoTopKey;
}

export function useMixedNavItems(navLayout: NavLayout, navItems: NavItem[], effectiveTopKey: string | null) {
  const mixedTopNavItems = useMemo(
    () => navItems.map(({ itemKey, text, icon, isExternal }) => ({ itemKey, text, icon, isExternal })),
    [navItems],
  );

  const mixedSidebarItems = useMemo(() => {
    if (navLayout !== 'mixed') return [];
    const top = navItems.find((i) => i.itemKey === effectiveTopKey);
    return top?.items ?? [];
  }, [navLayout, navItems, effectiveTopKey]);

  const doubleSubItems = useMemo(() => {
    if (navLayout !== 'double') return [];
    const top = navItems.find((i) => i.itemKey === effectiveTopKey);
    return top?.items ?? [];
  }, [navLayout, navItems, effectiveTopKey]);

  return { mixedTopNavItems, mixedSidebarItems, doubleSubItems };
}

// 页面缓存白名单：菜单开启 keepAlive 的路径（外链内嵌菜单取内部路由 /embed/{id}）
export function useKeepAlivePaths(menuTree: Menu[]) {
  const keepAlivePaths = useMemo(() => {
    const result = new Set<string>();
    const walk = (nodes: Menu[]) => {
      for (const node of nodes) {
        if (node.type === 'menu' && node.keepAlive && node.path && node.status === 'enabled') {
          if (node.isExternal) {
            if (node.embed) result.add(`/embed/${node.id}`);
          } else {
            result.add(node.path);
          }
        }
        if (node.children?.length) walk(node.children);
      }
    };
    walk(menuTree);
    return result;
  }, [menuTree]);
  return keepAlivePaths;
}
