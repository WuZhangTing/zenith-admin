/**
 * 通用表格列工具
 *
 * 提供常用的预置列对象和 render 辅助函数，避免在每个页面重复手写。
 */
import { Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps, Data } from '@douyinfe/semi-ui/lib/es/table';
import { formatDate, formatDateTime } from './date';

/** 空值统一占位符，禁止再使用 '-' / '–' 等变体 */
export const EMPTY_PLACEHOLDER = '—';

/** 日期时间列（YYYY-MM-DD HH:mm:ss）统一宽度 */
export const DATE_TIME_COLUMN_WIDTH = 180;

/** 纯日期列（YYYY-MM-DD）统一宽度 */
export const DATE_COLUMN_WIDTH = 120;

/**
 * 带省略 tooltip 的文本 render，空值自动显示 '—'
 *
 * @example
 * { title: '描述', dataIndex: 'description', render: renderEllipsis }
 */
export function renderEllipsis(v: string | null | undefined): React.ReactNode {
  return (
    <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }}>
      {v || EMPTY_PLACEHOLDER}
    </Typography.Text>
  );
}

export function renderEnabledStatusTag(value: string): React.ReactNode {
  return (
    <Tag color={value === 'enabled' ? 'green' : 'red'} size="small">
      {value === 'enabled' ? '启用' : '停用'}
    </Tag>
  );
}

type DateColumnValue = Date | string | number | null | undefined;

type TimeColumnOptions<RecordType extends Data> = Omit<
  ColumnProps<RecordType>,
  'title' | 'dataIndex' | 'render'
> & {
  /** 空值展示文案，用于「永久」「未发布」等语义化占位；默认 '—' */
  empty?: string;
};

function createTimeColumn<RecordType extends Data>(
  format: (value: DateColumnValue) => string,
  defaultWidth: number,
  title: string,
  dataIndex: string,
  options: TimeColumnOptions<RecordType> = {},
): ColumnProps<RecordType> {
  const { empty = EMPTY_PLACEHOLDER, width = defaultWidth, ...rest } = options;
  return {
    title,
    dataIndex,
    width,
    ...rest,
    render: (value: unknown) => (value ? format(value as DateColumnValue) : empty),
  };
}

/**
 * 日期时间列（统一宽度 180，格式化为 YYYY-MM-DD HH:mm:ss，空值显示 '—'）
 *
 * @example
 * dateTimeColumn('支付时间', 'paidAt')
 * dateTimeColumn('过期时间', 'expiresAt', { empty: '永久有效' })
 */
export function dateTimeColumn<RecordType extends Data = Data>(
  title: string,
  dataIndex: string,
  options?: TimeColumnOptions<RecordType>,
): ColumnProps<RecordType> {
  return createTimeColumn(formatDateTime, DATE_TIME_COLUMN_WIDTH, title, dataIndex, options);
}

/**
 * 纯日期列（统一宽度 120，格式化为 YYYY-MM-DD，空值显示 '—'）
 *
 * @example
 * dateColumn('账单日期', 'billDate')
 */
export function dateColumn<RecordType extends Data = Data>(
  title: string,
  dataIndex: string,
  options?: TimeColumnOptions<RecordType>,
): ColumnProps<RecordType> {
  return createTimeColumn(formatDate, DATE_COLUMN_WIDTH, title, dataIndex, options);
}

/**
 * 创建时间列
 *
 * @example
 * const columns = [..., createdAtColumn];
 */
export const createdAtColumn: ColumnProps = dateTimeColumn('创建时间', 'createdAt');

/**
 * 更新时间列
 *
 * @example
 * const columns = [..., updatedAtColumn];
 */
export const updatedAtColumn: ColumnProps = dateTimeColumn('更新时间', 'updatedAt');
