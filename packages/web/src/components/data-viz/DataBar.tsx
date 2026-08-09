import type { CSSProperties } from 'react';
import './bars.css';

/** 排名、占比、分布等相对数据条；仅作视觉编码，数值必须由相邻文本表达。 */
export interface DataBarProps {
  value: number;
  max: number;
  minPercent?: number;
  color?: string;
  fillOpacity?: number;
  track?: string;
  height?: number;
  radius?: CSSProperties['borderRadius'];
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export function DataBar({
  value,
  max,
  minPercent = 0,
  color,
  fillOpacity,
  track,
  height = 8,
  radius,
  title,
  className,
  style,
}: Readonly<DataBarProps>) {
  const ratio = Number.isFinite(value) && Number.isFinite(max) && max > 0
    ? value / max
    : 0;
  const percent = Math.min(100, Math.max(value > 0 ? minPercent : 0, ratio * 100));
  const classes = ['zx-data-bar', className].filter(Boolean).join(' ');
  const barStyle = {
    '--zx-bar-height': `${height}px`,
    '--zx-bar-scale': percent / 100,
    ...(color ? { '--zx-bar-stroke': color } : {}),
    ...(fillOpacity !== undefined ? { '--zx-bar-opacity': fillOpacity } : {}),
    ...(track ? { '--zx-bar-track': track } : {}),
    ...(radius !== undefined ? { '--zx-bar-radius': typeof radius === 'number' ? `${radius}px` : radius } : {}),
    ...style,
  } as CSSProperties;

  return (
    <div className={classes} style={barStyle} title={title} aria-hidden="true">
      <span className="zx-data-bar__fill" />
    </div>
  );
}

export default DataBar;
