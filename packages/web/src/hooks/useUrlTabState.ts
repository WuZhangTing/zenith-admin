import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOptionalPreferences } from '@/hooks/usePreferences';

/**
 * 将页面级 Tabs 的激活项与 URL 查询参数双向同步（如 `?tab=`）：
 * - 初次渲染从 URL 恢复，非法值回退默认 Tab；
 * - 切换 Tab 以 replace 写回 URL，默认 Tab 不写参数保持地址干净，且不污染浏览器历史；
 * - URL 外部变化（页签导航、前进/后退）时跟随切换；
 * - 只读写自己的参数，页面上其他查询参数原样保留。
 *
 * 受偏好「页面状态同步到地址栏」（`syncPageStateToUrl`，默认关）控制：
 * 关闭时降级为「消费即焚」——带参深链进入仍生效一次，随后参数从地址栏移除，
 * 切换 Tab 不再写 URL。无 PreferencesProvider 的入口（会员端等）保持始终同步。
 */
export function useUrlTabState<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramName = 'tab',
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const prefs = useOptionalPreferences();
  const syncToUrl = prefs ? (prefs.preferences.syncPageStateToUrl ?? false) : true;
  const validRef = useRef(validTabs);
  validRef.current = validTabs;

  const parse = (params: URLSearchParams): T => {
    const raw = params.get(paramName);
    return raw && (validRef.current as readonly string[]).includes(raw) ? (raw as T) : defaultTab;
  };

  const [activeTab, setActiveTab] = useState<T>(() => parse(searchParams));

  // URL → 状态：外部导航（如从别的页面带参进入、浏览器前进后退）时跟随
  useEffect(() => {
    if (syncToUrl) {
      setActiveTab(parse(searchParams));
      return;
    }
    // 消费模式：仅参数在场且合法时跟随——参数应用后即被移除，缺参不代表回默认
    const raw = searchParams.get(paramName);
    if (raw && (validRef.current as readonly string[]).includes(raw)) setActiveTab(raw as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, syncToUrl]);

  // 状态 → URL：基于 router 提供的最新 searchParams 只改自己的参数（兼容 BrowserRouter 与
  // HashRouter——后者的 query 在 hash 段内，window.location.search 读不到），其他参数原样保留；
  // 消费模式下只删不写
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (!syncToUrl || activeTab === defaultTab) next.delete(paramName);
    else next.set(paramName, activeTab);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, defaultTab, paramName, searchParams, setSearchParams, syncToUrl]);

  return [activeTab, setActiveTab];
}
