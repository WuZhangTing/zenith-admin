import { useEffect } from 'react';

// 菜单自动滚动至可视区：把选中项滚动到侧栏滚动容器的垂直中部
// 说明：
// 1. 不用 el.scrollIntoView({ block: 'nearest' })——它只做最小滚动，选中项常常贴在容器上/下边缘
//    （顶部还会被 sticky 的一级目录标题遮住），且会连带滚动所有可滚动祖先。
// 2. 路由切换往往伴随目录展开/收起动画，首帧拿到的是旧布局。这里用 rAF 轮询等待
//    「选中项位置 + 内容总高」连续两帧不变（即动画结束）后再一次性定位，避免用错误位置滚动。
export function useScrollMenuIntoView(
  currentSelectedKeys: string[],
  effectiveCollapsed: boolean,
  scrollMenuIntoView: boolean | undefined,
  reduceMotion: boolean,
) {
  useEffect(() => {
    if (!(scrollMenuIntoView ?? true) || effectiveCollapsed) return;
    // sticky 的一级目录标题会遮挡容器顶部，视觉安全区需要下移
    const SAFE_TOP = 48;
    const SAFE_BOTTOM = 24;
    // 初次进入时菜单数据是异步到达的，等待选中项出现的预算要比等待动画稳定的预算长；
    // 出现后仍持续观察一段时间：目录展开动画会让布局在首次定位之后继续变化（此时
    // 容器可能尚无可滚动空间 maxScroll=0），布局每次企稳都要重新定位一次。
    const APPEAR_WAIT = 5000;
    const WATCH_WAIT = 1200;
    const startedAt = performance.now();
    let appearedAt = 0;
    let rafId = 0;
    let prevKey = '';
    let stableFrames = 0;
    let settledKey = '';

    const settle = (container: HTMLElement, el: HTMLElement, offsetTop: number) => {
      const height = el.getBoundingClientRect().height;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;
      const relTop = offsetTop - container.scrollTop;
      const centerRatio = (relTop + height / 2) / container.clientHeight;
      // 已完整可见且落在中部舒适区（20%~80%）则不滚动，避免相邻菜单之间来回抖动
      if (relTop >= SAFE_TOP && relTop + height <= container.clientHeight - SAFE_BOTTOM
        && centerRatio >= 0.2 && centerRatio <= 0.8) return;
      const target = Math.min(Math.max(offsetTop - (container.clientHeight - height) / 2, 0), maxScroll);
      if (Math.abs(target - container.scrollTop) < 2) return;
      container.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    const tick = () => {
      const nav = document.querySelector('.admin-sidebar__nav');
      const container = nav?.querySelector<HTMLElement>('.semi-navigation-list-wrapper');
      const el = nav?.querySelector<HTMLElement>('.semi-navigation-item-selected');
      const now = performance.now();
      const elRect = el?.getBoundingClientRect();
      if (!container || !el || !elRect?.height) {
        // 选中项尚未出现（菜单数据未到达或目录未展开），在出现预算内继续等
        if (now - startedAt < APPEAR_WAIT) rafId = requestAnimationFrame(tick);
        return;
      }
      if (!appearedAt) appearedAt = now;
      const offsetTop = elRect.top - container.getBoundingClientRect().top + container.scrollTop;
      // 用「选中项绝对位置 + 内容总高」判定布局是否稳定（不受自身平滑滚动影响）
      const key = `${Math.round(offsetTop)}|${container.scrollHeight}`;
      if (key === prevKey) stableFrames += 1;
      else { prevKey = key; stableFrames = 0; }
      if (stableFrames >= 2 && key !== settledKey) {
        settledKey = key;
        settle(container, el, offsetTop);
      }
      if (now - appearedAt < WATCH_WAIT) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentSelectedKeys, effectiveCollapsed, scrollMenuIntoView, reduceMotion]);
}
