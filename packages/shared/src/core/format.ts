const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** 字节数格式化为可读字符串（B / KB / MB / GB / TB，1 位小数，B 取整）；空值、非正数或非有限数返回 '0 B' */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const index = Math.min(Math.max(Math.floor(Math.log2(bytes) / 10), 0), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${BYTE_UNITS[index]}`;
}
