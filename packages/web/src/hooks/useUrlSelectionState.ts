import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 将 MasterDetail 分栏页的选中项与 URL 查询参数双向同步（如 `?dict=`、`?file=`）：
 * - 初次渲染从 URL 恢复，刷新 / 分享链接 / 页签导航可直达某一项；
 * - 点选以 replace 写回 URL，未选中时删参数保持地址干净，且不污染浏览器历史；
 * - URL 外部变化（带参导航到已挂载页面、前进 / 后退）时跟随切换；
 * - 只读写自己的参数，`?tab=` 等其他查询参数原样保留。
 *
 * 与 `useUrlTabState` 的差异：合法值来自异步加载的列表数据，无法静态枚举，
 * 因此本 hook 只负责 URL↔state 同步，**数据就绪后的校验与回退由页面负责**：
 * - URL 值在列表中不存在时清空选中（或按业务回退，如日志轮转后改选 `.gz` 归档）；
 * - 「桌面端自动选中首项」应作为渲染期派生的回退（key 为 null 时取首项），
 *   而不是写回本状态——默认选中不入 URL，显式点选与深链才入。
 *
 * 参数名必须取所选实体的领域名词（`dict` / `channel` / `file` / `conv`…），
 * 让 URL 自解释；不要用 `id` / `item` 这类无信息量的通用名。
 *
 * 与 `useListDeepLink` 的区别：后者是列表筛选参数的「消费即焚」，本 hook 是
 * 选中态的持久双向同步，二者可在同一页面共存。
 */
export function useUrlSelectionState(
  paramName: string,
): [string | null, Dispatch<SetStateAction<string | null>>] {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selected, setSelected] = useState<string | null>(() => searchParams.get(paramName));

  // URL → 状态：外部导航（带参进入已挂载页面、浏览器前进后退）时跟随
  useEffect(() => {
    setSelected(searchParams.get(paramName));
  }, [searchParams, paramName]);

  // 状态 → URL：基于 router 提供的最新 searchParams 只改自己的参数（兼容 BrowserRouter 与
  // HashRouter——后者的 query 在 hash 段内，window.location.search 读不到），其他参数原样保留
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selected === null || selected === '') next.delete(paramName);
    else next.set(paramName, selected);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [selected, paramName, searchParams, setSearchParams]);

  return [selected, setSelected];
}
