import { Typography } from '@douyinfe/semi-ui';

/**
 * 日志/统计场景的用户展示名：优先昵称，括注用户名便于精确定位。
 * 昵称缺失（用户已删除）或与用户名相同时只显示用户名。
 */
export function formatUserLabel(username: string | null | undefined, nickname?: string | null): string {
  if (!username) return '-';
  if (nickname && nickname !== username) return `${nickname}（${username}）`;
  return username;
}

/**
 * 图表轴显示名解析器：优先只显示昵称；同批数据昵称冲突（或与他人用户名撞名）时，
 * 该项退化为「昵称（用户名）」保证类目唯一。返回 name→完整标签 的映射供 tooltip 使用。
 */
export function buildUserChartLabels(
  items: ReadonlyArray<{ username: string; nickname?: string | null }>,
): { nameOf: (item: { username: string; nickname?: string | null }) => string; fullOf: Map<string, string> } {
  const shortNameCount = new Map<string, number>();
  for (const it of items) {
    const short = it.nickname || it.username;
    shortNameCount.set(short, (shortNameCount.get(short) ?? 0) + 1);
  }
  const fullOf = new Map<string, string>();
  const nameOf = (it: { username: string; nickname?: string | null }) => {
    const short = it.nickname || it.username;
    const name = (shortNameCount.get(short) ?? 0) > 1 ? formatUserLabel(it.username, it.nickname) : short;
    fullOf.set(name, formatUserLabel(it.username, it.nickname));
    return name;
  };
  return { nameOf, fullOf };
}

/**
 * 表格用户单元格：单行「昵称（用户名）」，超宽省略并悬浮补全。
 * 昵称缺失或与用户名相同时退化为用户名。
 */
export function UserDisplayCell({ username, nickname }: Readonly<{ username: string | null | undefined; nickname?: string | null }>) {
  if (!username) return <span style={{ color: 'var(--semi-color-text-2)' }}>-</span>;
  return (
    <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }}>
      {formatUserLabel(username, nickname)}
    </Typography.Text>
  );
}
