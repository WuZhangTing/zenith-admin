/** 把数值限制在 [min, max]；非有限数（NaN / Infinity）按 min 处理 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
