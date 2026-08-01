import { useEffect, useState } from 'react';

// 无条件同步展开链：收起态由渲染层 `effectiveCollapsed ? [] : openKeys` 门控，
// state 层不做 collapsed 判断（否则 hover 模式下 collapsed 恒为 true，openKeys 永远为空，
// 刷新后悬浮展开/手动展开时当前页面所属目录不会自动展开）
export function useSidebarOpenKeys(currentSectionKeys: string[] | null, sidebarAccordion: boolean | undefined) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    // null = 路径不在菜单树中（如详情页），保持当前展开状态
    if (currentSectionKeys === null) return;
    if (sidebarAccordion) {
      // 手风琴模式：仅保留当前路径的祖先链；顶级菜单项（祖先链为空）收起全部目录
      setOpenKeys(currentSectionKeys);
    } else if (currentSectionKeys.length > 0) {
      setOpenKeys((prev) => Array.from(new Set([...prev, ...currentSectionKeys])));
    }
  }, [currentSectionKeys, sidebarAccordion]);

  return { openKeys, setOpenKeys };
}
