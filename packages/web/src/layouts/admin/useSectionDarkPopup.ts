import { useCallback, useEffect, useRef } from 'react';

const ALWAYS_DARK_CLASS = 'semi-always-dark';
const POPUP_ROOT_CLASS = 'admin-dark-popup-root';

/**
 * 分区深色（局部暗色）下的 Semi 弹层挂载点。
 *
 * Semi 的局部暗色要求弹层 DOM 落在带 `.semi-always-dark` 的节点内部，否则弹层挂到 body 上
 * 仍是全局配色。但侧边栏 / 顶栏本身是 `overflow: hidden` 的布局容器，直接拿它当
 * `getPopupContainer` 会把飞出菜单裁掉，因此在 body 下单独维护一个挂载节点：
 * 零尺寸、绝对定位于文档原点，Semi 用 `container.getBoundingClientRect()` 做坐标换算
 * （见 semi-foundation/tooltip/foundation 的 `left -= containerRect.left`），
 * 因此定位结果与默认挂到 body 完全一致。
 *
 * 节点身份必须稳定：Semi 的 Portal 只在挂载时读取一次容器，所以开关深色只切换 class 与
 * 品牌色变量，不重建节点。
 *
 * @param dark 该分区当前是否启用深色
 * @param vars 需要注入节点的 CSS 变量（`.semi-always-dark` 会把 primary 复位成 Semi 默认蓝，
 *             品牌主色要在此重新注入）。必须是稳定引用。
 * @returns 启用深色时返回 `getPopupContainer`，否则返回 undefined（弹层走 Semi 默认的 body）
 */
export function useSectionDarkPopupContainer(
  dark: boolean,
  vars: Record<string, string>,
): (() => HTMLElement) | undefined {
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const getContainer = useCallback(() => {
    let node = nodeRef.current;
    if (!node) {
      node = document.createElement('div');
      node.className = POPUP_ROOT_CLASS;
      document.body.appendChild(node);
      nodeRef.current = node;
    }
    return node;
  }, []);

  useEffect(() => {
    // 关闭且从未创建过节点时不产生任何 DOM
    const node = dark ? getContainer() : nodeRef.current;
    if (!node) return;
    node.classList.toggle(ALWAYS_DARK_CLASS, dark);
    for (const [name, value] of Object.entries(vars)) node.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) node.style.removeProperty(name);
    };
  }, [dark, vars, getContainer]);

  useEffect(
    () => () => {
      nodeRef.current?.remove();
      nodeRef.current = null;
    },
    [],
  );

  return dark ? getContainer : undefined;
}
