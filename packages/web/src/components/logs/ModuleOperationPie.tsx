/**
 * 按模块操作分布饼图（首页仪表盘与操作日志统计分析共用）。
 *
 * 输入为 { module, count } 列表；超出配色数量的尾部模块聚合为「其他」，
 * 保证扇区与外部百分比标签可读。加载态与空态占位由使用方决定。
 */
import { useMemo, type ReactNode } from 'react';
import { PieChart, chartOptions, makePieSpec, useChartPalette } from '@/components/charts';

const PIE_COLORS = [
  '#4A90E2', '#52C41A', '#FA8C16', '#13C2C2',
  '#722ED1', '#F5222D', '#EB2F96', '#1677FF',
];
const OTHER_COLOR = '#94A3B8';

export interface ModuleOperationDatum {
  readonly module: string;
  readonly count: number;
}

interface ModuleOperationPieProps {
  readonly data: readonly ModuleOperationDatum[];
  readonly height?: number;
  /** 数据为空时渲染的占位内容 */
  readonly empty?: ReactNode;
}

export function ModuleOperationPie({ data, height = 200, empty = null }: ModuleOperationPieProps) {
  const palette = useChartPalette();

  const spec = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const head = sorted.slice(0, PIE_COLORS.length);
    const restCount = sorted.slice(PIE_COLORS.length).reduce((sum, d) => sum + d.count, 0);
    const coloredData = [
      ...head.map((item, idx) => ({ ...item, fill: PIE_COLORS[idx % PIE_COLORS.length] })),
      ...(restCount > 0 ? [{ module: '其他', count: restCount, fill: OTHER_COLOR }] : []),
    ];
    return makePieSpec({
      data: coloredData,
      categoryField: 'module',
      valueField: 'count',
      donut: false,
      colors: coloredData.map((d) => d.fill),
      palette,
      label: 'percent',
      valueUnit: '次',
    });
  }, [data, palette]);

  if (data.length === 0) return <>{empty}</>;
  return <PieChart {...spec} options={chartOptions} height={height} />;
}
