import type { MonitorAlertLevel, MonitorMetric } from '@zenith/shared/platform';
import { MONITOR_METRIC_META } from '@zenith/shared/platform';

// 指标标签 / 分组 / 单位的唯一来源是 `@zenith/shared/platform` 的 MONITOR_METRIC_META，
// 本文件只做展示层的派生（单位归类、级别配色），不再复制一份中文映射。
export {
  MONITOR_METRIC_LABELS,
  MONITOR_METRIC_OPTIONS,
  MONITOR_METRIC_GROUPED_OPTIONS,
  MONITOR_METRIC_META,
  formatMonitorMetricValue,
} from '@zenith/shared/platform';

export const MONITOR_PERCENT_METRICS = new Set<MonitorMetric>(
  (Object.keys(MONITOR_METRIC_META) as MonitorMetric[]).filter((m) => MONITOR_METRIC_META[m].unit === 'percent'),
);

export const MONITOR_BYTES_METRICS = new Set<MonitorMetric>(
  (Object.keys(MONITOR_METRIC_META) as MonitorMetric[]).filter((m) => MONITOR_METRIC_META[m].unit === 'bps'),
);

export const MONITOR_ALERT_LEVEL_CONFIG: Record<
  MonitorAlertLevel,
  { label: string; color: 'blue' | 'amber' | 'red' }
> & Record<string, { label: string; color: 'blue' | 'amber' | 'red' }> = {
  info: { label: '提示', color: 'blue' },
  warning: { label: '警告', color: 'amber' },
  critical: { label: '严重', color: 'red' },
};
