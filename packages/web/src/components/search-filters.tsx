/**
 * 列表页搜索工具栏的标准筛选控件。
 *
 * 与 `toolbar-controls.tsx`（查询/重置/新增按钮）配套：那边收敛的是动作按钮，
 * 这边收敛的是筛选输入。二者都只把**装饰性 props**（图标、尺寸、showClear、
 * 默认宽度）收进默认值，业务 props（value/onChange/placeholder）仍由页面显式传入——
 * 否则组件会退化成难以定制的黑盒。
 *
 * @example
 * <SearchToolbar
 *   primary={(
 *     <>
 *       <KeywordInput placeholder="搜索名称/编码" value={draftParams.keyword}
 *         onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} />
 *       <StatusSelect items={statusItems} value={draftParams.status}
 *         onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))} />
 *       <SearchButton onClick={handleSearch} />
 *       <ResetButton onClick={handleReset} />
 *     </>
 *   )}
 * />
 */
import { DatePicker, Input, Select } from '@douyinfe/semi-ui';
import type { InputProps } from '@douyinfe/semi-ui/lib/es/input';
import type { SelectProps } from '@douyinfe/semi-ui/lib/es/select';
import type { DatePickerProps } from '@douyinfe/semi-ui/lib/es/datePicker';
import { Search } from 'lucide-react';

interface KeywordInputProps extends Omit<InputProps, 'onChange' | 'value' | 'prefix'> {
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  /** 回车触发查询；等价于 Semi 的 onEnterPress，省去在页面重复写 */
  readonly onSearch?: () => void;
  /** 输入框宽度，默认 220 */
  readonly width?: number | string;
}

/**
 * 关键字搜索输入框：统一放大镜前缀、清除按钮与默认宽度。
 * 改图标或尺寸时只需改这里，不必扫遍两百多个页面。
 */
export function KeywordInput({ value, onChange, onSearch, width = 220, style, ...rest }: KeywordInputProps) {
  return (
    <Input
      prefix={<Search size={14} />}
      value={value}
      onChange={onChange}
      onEnterPress={onSearch}
      showClear
      style={{ width, maxWidth: '100%', ...style }}
      {...rest}
    />
  );
}

interface StatusSelectProps extends Omit<SelectProps, 'onChange' | 'value' | 'optionList'> {
  /** 字典项，通常来自 `useDictItems('common_status').items` */
  readonly items: readonly { value: string; label: string }[];
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  /** 下拉宽度，默认 120 */
  readonly width?: number | string;
}

/**
 * 状态筛选下拉：把字典项映射成 optionList 的样板收敛于此。
 * 清空时回调收到空串（而非 `undefined`），与 `draftParams` 里状态字段的类型对齐。
 */
export function StatusSelect({
  items,
  value,
  onChange,
  width = 120,
  placeholder = '全部状态',
  style,
  ...rest
}: StatusSelectProps) {
  return (
    <Select
      placeholder={placeholder}
      value={value || undefined}
      onChange={(v) => onChange((v as string) ?? '')}
      optionList={items.map((item) => ({ value: item.value, label: item.label }))}
      showClear
      style={{ width, maxWidth: '100%', ...style }}
      {...rest}
    />
  );
}

interface DateRangeFilterProps extends Omit<DatePickerProps, 'onChange' | 'value' | 'type'> {
  /** 页面的区间状态用 `null` 或 `undefined` 表示未选择都可以 */
  readonly value: [Date, Date] | null | undefined;
  readonly onChange: (range: [Date, Date] | null) => void;
  /** `dateTimeRange` 精确到秒（默认），`dateRange` 只选日期 */
  readonly type?: 'dateTimeRange' | 'dateRange';
  /** 选择器宽度，默认按 type 取 360 / 260 */
  readonly width?: number | string;
}

/**
 * 时间范围筛选：统一占位文案与宽度，并把 Semi 宽松的 onChange 值收窄成
 * `[Date, Date] | null`——页面此前各自手写 `Array.isArray(v) && v.length >= 2` 之类的判断。
 */
export function DateRangeFilter({
  value,
  onChange,
  type = 'dateTimeRange',
  width,
  placeholder,
  style,
  ...rest
}: DateRangeFilterProps) {
  const isDateTime = type === 'dateTimeRange';
  return (
    <DatePicker
      type={type}
      placeholder={placeholder ?? (isDateTime ? ['开始时间', '结束时间'] : ['开始日期', '结束日期'])}
      value={value ?? undefined}
      onChange={(v) => {
        const [from, to] = Array.isArray(v) ? v : [];
        onChange(from instanceof Date && to instanceof Date ? [from, to] : null);
      }}
      style={{ width: width ?? (isDateTime ? 360 : 260), maxWidth: '100%', ...style }}
      {...rest}
    />
  );
}
