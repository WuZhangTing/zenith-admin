import type { CSSProperties, ReactNode } from 'react';
import { sectionStyle } from './helpers';
import './stat-card.css';

/**
 * 统计卡片栅格。
 *
 * 列数由容器可用宽度决定（`auto-fit` + `minmax`），窄屏自动降列，无需媒体查询。
 * **禁止**在页面里内联写死 `gridTemplateColumns: 'repeat(4, 1fr)'` 这类固定列数——
 * 内联样式无法被媒体查询覆盖，窄屏会把卡片压到内容竖排。
 *
 * `min(minItemWidth, 100%)` 保证容器比单列还窄时不会溢出。
 */
export function StatGrid({
  children,
  minItemWidth = 180,
  gap = 12,
  className,
  style,
}: Readonly<{
  children: ReactNode;
  /** 单卡最小宽度，低于此值即减少列数 */
  minItemWidth?: number;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}>) {
  return (
    <div
      className={['stat-grid', className].filter(Boolean).join(' ')}
      style={{
        ...style,
        // 自定义属性交给 CSS 计算列宽，避免把 grid-template-columns 写成内联样式
        ['--stat-grid-min' as string]: `${minItemWidth}px`,
        ['--stat-grid-gap' as string]: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * 统一统计卡片：图标（可选）+ 数值 + 标题 + 副文案（可选）。
 *
 * 覆盖既有各页自定义卡片的能力并集：`delta` 环比、`onClick`/`active` 可筛选态。
 * 需要图标时传 `icon` 与 `accent`，两者共同决定图标底色。
 */
export function StatCard({
  title,
  value,
  sub,
  icon,
  accent,
  delta,
  deltaLabel = '较昨日',
  deltaFormat = 'absolute',
  onClick,
  active = false,
  className,
}: Readonly<{
  title: ReactNode;
  value: ReactNode;
  /** 副文案（如「成功 13 · 失败 0」） */
  sub?: ReactNode;
  icon?: ReactNode;
  /** 强调色：作用于数值与图标底色 */
  accent?: string;
  /** 环比增量，正负分别显示为成功/危险色；null 或 undefined 时不渲染 */
  delta?: number | null;
  deltaLabel?: string;
  /** `absolute` 直接展示数值；`ratio` 按比率渲染为百分比（0.12 → +12.0%） */
  deltaFormat?: 'absolute' | 'ratio';
  /** 传入后卡片变为可点击（用于按状态筛选列表） */
  onClick?: () => void;
  /** 可点击卡片的选中态 */
  active?: boolean;
  className?: string;
}>) {
  const interactive = typeof onClick === 'function';

  const body = (
    <>
      {icon && (
        <span
          className="stat-card__icon"
          style={{
            background: accent ? `color-mix(in srgb, ${accent} 14%, transparent)` : undefined,
            color: accent,
          }}
        >
          {icon}
        </span>
      )}
      <span className="stat-card__body">
        <span className="stat-card__value" style={accent ? { color: accent } : undefined}>{value}</span>
        <span className="stat-card__title">{title}</span>
        {sub !== undefined && sub !== null && sub !== '' && (
          <span className="stat-card__sub">{sub}</span>
        )}
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`stat-card__delta stat-card__delta--${delta >= 0 ? 'up' : 'down'}`}>
            {deltaLabel} {delta >= 0 ? '+' : ''}
            {deltaFormat === 'ratio' ? `${(delta * 100).toFixed(1)}%` : delta}
          </span>
        )}
      </span>
    </>
  );

  const classes = [
    'stat-card',
    interactive && 'stat-card--interactive',
    interactive && active && 'stat-card--active',
    className,
  ].filter(Boolean).join(' ');

  const cardStyle: CSSProperties = {
    ...sectionStyle,
    ...(interactive && active && accent ? { borderColor: accent } : null),
  };

  if (interactive) {
    return (
      <button type="button" className={classes} style={cardStyle} onClick={onClick} aria-pressed={active}>
        {body}
      </button>
    );
  }

  return <div className={classes} style={cardStyle}>{body}</div>;
}
