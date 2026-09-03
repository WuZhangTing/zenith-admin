import { EMPTY_PLACEHOLDER } from '@/utils/table-columns';

/** 毫秒时长格式化（ms → s → min），空值返回占位符：适合任务 / 调度 / 接口耗时展示 */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return EMPTY_PLACEHOLDER;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}
