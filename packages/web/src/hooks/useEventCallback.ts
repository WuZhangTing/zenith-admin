import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * 返回引用永久稳定的事件回调，内部始终调用最近一次渲染传入的实现。
 *
 * 用途：让 `memo` 化的子组件不会因为父组件每次渲染重建内联函数而失效。
 * 直接用 `useCallback` 时，只要依赖里含有高频变化的值（如 tabs、activeKey），
 * 回调引用仍会变，memo 随之全部落空。
 *
 * 约束：返回的函数不可在渲染期调用（ref 在 layout effect 阶段才更新），
 * 只能用于事件处理器 / effect。
 */
export function useEventCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
