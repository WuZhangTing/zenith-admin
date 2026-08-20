import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlSelection<K extends string> = Readonly<Record<K, string | null>>;

function readSelection<K extends string>(
  params: URLSearchParams,
  names: readonly K[],
): UrlSelection<K> {
  const out = {} as Record<K, string | null>;
  for (const name of names) out[name] = params.get(name);
  return out;
}

function selectionEquals<K extends string>(
  a: UrlSelection<K>,
  b: UrlSelection<K>,
  names: readonly K[],
): boolean {
  return names.every((name) => a[name] === b[name]);
}

/**
 * 将 MasterDetail 分栏页的选中项（及其上下文）与 URL 查询参数双向同步
 * （如 `?dict=`、`?site=&channel=`）：
 * - 初次渲染从 URL 恢复，刷新 / 分享链接 / 页签导航可直达某一项；
 * - 点选以 replace 写回 URL，未选中时删参数保持地址干净，且不污染浏览器历史；
 * - URL 外部变化（带参导航到已挂载页面、前进 / 后退）时跟随切换；
 * - 只读写自己声明的参数，`?tab=` 等其他查询参数原样保留。
 *
 * **多参数必须由同一个 hook 实例原子管理**（如站点 + 栏目、公众号 + 会话）：
 * 同一页面挂两个写 URL 的 hook 实例会双 effect 竞写 searchParams——react-router 的
 * setSearchParams（含函数式）基于渲染期快照，同帧两次写入互相覆盖，URL→state
 * 跟随效应放大为来回震荡。同理，页面已用 `useUrlTabState` 时选中项不得再入 URL
 * （以 tab 为准）。
 *
 * 与 `useUrlTabState` 的差异：合法值来自异步加载的列表数据，无法静态枚举，
 * 因此本 hook 只负责 URL↔state 同步，**数据就绪后的校验与回退由页面负责**：
 * - 无效值的清理时机：详情 / 列表查询落定后确认不存在才清参，数据在途时等待；
 *   分页列表不能拿「当前页成员资格」当存在性判据，深链目标可能在其他页
 *   （按 id 拉详情兜底，见 DictsPage）；
 * - 「桌面端自动选中首项」应作为渲染期派生的回退（key 为 null 时取首项），
 *   而不是写回本状态——默认选中不入 URL，显式点选与深链才入。
 *
 * 参数名必须取所选实体的领域名词（`dict` / `channel` / `file` / `session`…），
 * 让 URL 自解释；不要用 `id` / `item` 这类无信息量的通用名。
 *
 * 与 `useListDeepLink` 的区别：后者是列表筛选参数的「消费即焚」，本 hook 是
 * 选中态的持久双向同步，二者可在同一页面共存。
 */
export function useUrlSelectionParams<K extends string>(
  paramNames: readonly K[],
): [UrlSelection<K>, Dispatch<SetStateAction<UrlSelection<K>>>] {
  const [searchParams, setSearchParams] = useSearchParams();

  // 页面以字面量数组传入，视为常量；ref 兜底避免不稳定引用触发 effect 重跑
  const namesRef = useRef(paramNames);
  namesRef.current = paramNames;

  const [selection, setSelection] = useState<UrlSelection<K>>(
    () => readSelection(searchParams, namesRef.current),
  );

  // URL → 状态：外部导航（带参进入已挂载页面、浏览器前进后退）时跟随
  useEffect(() => {
    setSelection((prev) => {
      const next = readSelection(searchParams, namesRef.current);
      return selectionEquals(prev, next, namesRef.current) ? prev : next;
    });
  }, [searchParams]);

  // 状态 → URL：基于 router 提供的最新 searchParams 只改自己的参数（兼容 BrowserRouter 与
  // HashRouter——后者的 query 在 hash 段内，window.location.search 读不到），其他参数原样保留
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    for (const name of namesRef.current) {
      const value = selection[name];
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [selection, searchParams, setSearchParams]);

  return [selection, setSelection];
}

/** 单参数便捷封装：`useUrlSelectionParams` 的值 / setter 映射为 `string | null` */
export function useUrlSelectionState(
  paramName: string,
): [string | null, Dispatch<SetStateAction<string | null>>] {
  const [selection, setSelection] = useUrlSelectionParams([paramName]);

  const setValue = useCallback<Dispatch<SetStateAction<string | null>>>((action) => {
    setSelection((prev) => {
      const prevValue = prev[paramName];
      const nextValue = typeof action === 'function' ? action(prevValue) : action;
      return nextValue === prevValue ? prev : { [paramName]: nextValue };
    });
  }, [paramName, setSelection]);

  return [selection[paramName], setValue];
}
