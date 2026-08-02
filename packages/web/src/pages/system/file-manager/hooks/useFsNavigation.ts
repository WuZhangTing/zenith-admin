/**
 * 目录导航：当前路径 + 前进/后退历史 + 路径直达输入。
 * 数据来源：useTerminalRootInfo（初始定位主目录/盘符根）+ useTerminalFileList（目录清单）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalFileList, useTerminalRootInfo } from '@/hooks/queries/terminal-files';
import { buildBreadcrumbs } from '../fs-utils';

export function useFsNavigation(options: { onNavigate?: () => void } = {}) {
  const [currentPath, setCurrentPath] = useState('');
  const historyRef = useRef<{ paths: string[]; index: number }>({ paths: [], index: -1 });
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  // 路径直达输入（Ctrl+L / 铅笔按钮）
  const [pathEditing, setPathEditing] = useState(false);
  const [pathDraft, setPathDraft] = useState('');

  // onNavigate 经 ref 转发，navigateTo 保持稳定引用
  const onNavigateRef = useRef(options.onNavigate);
  onNavigateRef.current = options.onNavigate;

  const rootInfoQuery = useTerminalRootInfo();
  const rootInfo = rootInfoQuery.data ?? null;
  const listQuery = useTerminalFileList(currentPath, currentPath !== '');

  const navigateTo = useCallback(async (p: string, pushHistory = true) => {
    onNavigateRef.current?.();
    setCurrentPath(p);
    if (pushHistory) {
      const h = historyRef.current;
      const newStack = [...h.paths.slice(0, h.index + 1), p];
      historyRef.current = { paths: newStack, index: newStack.length - 1 };
      setCanBack(newStack.length > 1);
      setCanForward(false);
    }
  }, []);

  // 首载：定位到主目录所在盘符根（Windows）或 /
  useEffect(() => {
    if (!rootInfo || currentPath) return;
    const { home, isWindows, drives } = rootInfo;
    const rootPath = isWindows ? ((/^([A-Za-z]:)/.exec(home)?.[1] ?? drives[0] ?? 'C:') + '\\') : '/';
    void navigateTo(rootPath);
  }, [rootInfo, currentPath, navigateTo]);

  useEffect(() => {
    // 后端规范化路径回写；须忽略 keepPreviousData 的占位数据（其 path 为旧目录），
    // 否则单击进入新目录会被立即回退（表现为闪一下、第二次点击才生效）
    if (!listQuery.isPlaceholderData && listQuery.data?.path && listQuery.data.path !== currentPath) {
      setCurrentPath(listQuery.data.path);
    }
  }, [listQuery.data, listQuery.isPlaceholderData, currentPath]);

  const refresh = useCallback(() => void listQuery.refetch(), [listQuery]);

  const goBack = useCallback(async () => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    const newIndex = h.index - 1;
    historyRef.current = { ...h, index: newIndex };
    setCanBack(newIndex > 0);
    setCanForward(true);
    await navigateTo(h.paths[newIndex], false);
  }, [navigateTo]);

  const goForward = useCallback(async () => {
    const h = historyRef.current;
    if (h.index >= h.paths.length - 1) return;
    const newIndex = h.index + 1;
    historyRef.current = { ...h, index: newIndex };
    setCanBack(true);
    setCanForward(newIndex < h.paths.length - 1);
    await navigateTo(h.paths[newIndex], false);
  }, [navigateTo]);

  /** 返回上级目录（Backspace 快捷键 / 面包屑倒数第二段） */
  const goUp = useCallback(() => {
    const crumbs = currentPath ? buildBreadcrumbs(currentPath) : [];
    if (crumbs.length < 2) return;
    void navigateTo(crumbs[crumbs.length - 2].path);
  }, [currentPath, navigateTo]);

  const startPathEdit = useCallback(() => {
    setPathDraft(currentPath);
    setPathEditing(true);
  }, [currentPath]);

  const breadcrumbs = currentPath ? buildBreadcrumbs(currentPath) : [];

  return {
    rootInfo,
    rootInfoQuery,
    listQuery,
    currentPath,
    navigateTo,
    refresh,
    goBack,
    goForward,
    goUp,
    canBack,
    canForward,
    breadcrumbs,
    pathEditing,
    setPathEditing,
    pathDraft,
    setPathDraft,
    startPathEdit,
  };
}
