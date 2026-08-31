/**
 * 通用表格列工具
 *
 * 提供常用的预置列对象和 render 辅助函数，避免在每个页面重复手写。
 */
import { Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps, Data } from '@douyinfe/semi-ui/lib/es/table';
import { Check } from 'lucide-react';
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

/** 业务单号列（genNo 生成的定长编号）统一宽度：26 字符 + 复制图标完整单行展示 */
export const NO_COLUMN_WIDTH = 280;

/**
 * 复制成功的行内反馈：仅一个对勾图标。
 * Semi 默认的「✓ 复制成功」文字比复制图标宽得多，会把定宽单元格撑溢出；
 * 图标反馈与复制图标同宽，原位提示且不打扰（不弹 Toast）。
 */
const COPY_SUCCESS_TIP = (
  <Check size={14} aria-label="复制成功" style={{ color: 'var(--semi-color-success)', verticalAlign: 'text-bottom' }} />
);

/**
 * 业务单号列（订单号 / 退款单号 / 批次号等 genNo 生成的定长编号）：
 * 完整单行展示 + 复制按钮，空值显示 '—'。
 *
 * **禁止**给单号列写 `ellipsis + copyable + 固定像素 maxWidth`——Semi Typography
 * 的 ellipsis 是 JS 测量截断，与 copyable 图标组合时测量偏保守，会把列宽足够
 * 容纳的定长单号误截断且不随列宽恢复。定长单号直接完整展示即可。
 *
 * @example
 * copyableNoColumn('订单号', 'orderNo')
 * copyableNoColumn('批次号', 'batchNo', { width: 300, fixed: 'left' })
 */
export function copyableNoColumn<RecordType extends Data = Data>(
  title: string,
  dataIndex: string,
  options?: Pick<ColumnProps<RecordType>, 'width' | 'fixed' | 'sorter'>,
): ColumnProps<RecordType> {
  return {
    title,
    dataIndex,
    width: NO_COLUMN_WIDTH,
    ...options,
    render: (v: string | null | undefined) => (v
      ? (
        // stopPropagation：expandRowByClick 的表格里，点复制按钮/选中单号不应触发行展开
        <span onClick={(e) => e.stopPropagation()}>
          <Typography.Text style={{ whiteSpace: 'nowrap' }} copyable={{ content: v, successTip: COPY_SUCCESS_TIP }}>{v}</Typography.Text>
        </span>
      )
      : EMPTY_PLACEHOLDER),
  };
}

export function renderEnabledStatusTag(value: string): React.ReactNode {
  return (
    <Tag color={value === 'enabled' ? 'green' : 'red'} size="small">
      {value === 'enabled' ? '启用' : '停用'}
    </Tag>
  );
}

type DateColumnValue = Date | string | number | null | undefined;

/** 时间戳数值的单位；后端多数返回字符串时间，Docker 等外部系统返回 unix 秒 */
type TimeUnit = 'millisecond' | 'second';

type TimeColumnOptions<RecordType extends Data> = Omit<
  ColumnProps<RecordType>,
  'title' | 'dataIndex' | 'render'
> & {
  /** 空值展示文案，用于「永久」「未发布」等语义化占位；默认 '—' */
  empty?: string;
  /** 数值时间戳的单位，默认毫秒；unix 秒时间戳传 'second' */
  unit?: TimeUnit;
};

function createTimeColumn<RecordType extends Data>(
  format: (value: DateColumnValue) => string,
  defaultWidth: number,
  title: string,
  dataIndex: string,
  options: TimeColumnOptions<RecordType> = {},
): ColumnProps<RecordType> {
  const { empty = EMPTY_PLACEHOLDER, width = defaultWidth, unit = 'millisecond', ...rest } = options;
  return {
    title,
    dataIndex,
    width,
    ...rest,
    render: (value: unknown) => {
      if (!value) return empty;
      const input = (unit === 'second' && typeof value === 'number'
        ? value * 1000
        : value) as DateColumnValue;
      return format(input);
    },
  };
}

/**
 * 日期时间列（统一宽度 180，格式化为 YYYY-MM-DD HH:mm:ss，空值显示 '—'）
 *
 * @example
 * dateTimeColumn('支付时间', 'paidAt')
 * dateTimeColumn('过期时间', 'expiresAt', { empty: '永久有效' })
 * dateTimeColumn('创建时间', 'created', { unit: 'second' })
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
