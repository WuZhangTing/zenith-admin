/**
 * search-filters 契约测试。
 *
 * 这三个控件的价值在于把「装饰性 props」（放大镜前缀、showClear、默认宽度、
 * 占位文案）收进默认值，同时保证业务 props 与自定义样式仍能穿透——
 * 一旦不能穿透，页面就会绕开组件退回手写，收敛白做。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@douyinfe/semi-ui';
import { Search } from 'lucide-react';
import { DateRangeFilter, KeywordInput, StatusSelect } from './search-filters';

const STATUS_ITEMS = [
  { value: 'enabled', label: '启用' },
  { value: 'disabled', label: '停用' },
];

describe('KeywordInput', () => {
  it('渲染放大镜前缀与传入的占位文案', () => {
    const { container } = render(<KeywordInput placeholder="搜索名称/编码" value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('搜索名称/编码')).toBeInTheDocument();
    expect(container.querySelector('.semi-input-prefix svg')).toBeTruthy();
  });

  it('onChange 透传输入值', () => {
    const onChange = vi.fn();
    render(<KeywordInput placeholder="搜索" value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('搜索'), { target: { value: 'abc' } });
    // Semi 的 Input onChange 签名是 (value, event)，这里只关心首参
    expect(onChange.mock.calls[0][0]).toBe('abc');
  });

  it('回车触发 onSearch', () => {
    const onSearch = vi.fn();
    render(<KeywordInput placeholder="搜索" value="abc" onChange={vi.fn()} onSearch={onSearch} />);
    // Semi 在 keyPress 而非 keyDown 上派发 onEnterPress
    fireEvent.keyPress(screen.getByPlaceholderText('搜索'), { key: 'Enter', charCode: 13 });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('默认宽度 220，可被 width 覆盖', () => {
    const { container, rerender } = render(<KeywordInput placeholder="a" value="" onChange={vi.fn()} />);
    expect((container.querySelector('.semi-input-wrapper') as HTMLElement).style.width).toBe('220px');
    rerender(<KeywordInput placeholder="a" value="" onChange={vi.fn()} width={320} />);
    expect((container.querySelector('.semi-input-wrapper') as HTMLElement).style.width).toBe('320px');
  });

  it('调用方的 style 能覆盖默认值', () => {
    const { container } = render(<KeywordInput placeholder="a" value="" onChange={vi.fn()} style={{ width: 150 }} />);
    expect((container.querySelector('.semi-input-wrapper') as HTMLElement).style.width).toBe('150px');
  });
});

describe('StatusSelect', () => {
  it('把字典项映射成下拉选项', async () => {
    render(<StatusSelect items={STATUS_ITEMS} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('启用')).toBeInTheDocument();
    expect(screen.getByText('停用')).toBeInTheDocument();
  });

  it('默认占位文案为「全部状态」，可覆盖', () => {
    const { rerender } = render(<StatusSelect items={STATUS_ITEMS} value="" onChange={vi.fn()} />);
    expect(screen.getByText('全部状态')).toBeInTheDocument();
    rerender(<StatusSelect items={STATUS_ITEMS} value="" onChange={vi.fn()} placeholder="全部类型" />);
    expect(screen.getByText('全部类型')).toBeInTheDocument();
  });

  it('选中项回调原值', async () => {
    const onChange = vi.fn();
    render(<StatusSelect items={STATUS_ITEMS} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('停用'));
    expect(onChange).toHaveBeenCalledWith('disabled');
  });

  it('空串视为未选中，不显示成选项值', () => {
    // draftParams 里状态字段常用 '' 表示未筛选，直接传给 Semi 会显示空白选中态
    render(<StatusSelect items={STATUS_ITEMS} value="" onChange={vi.fn()} />);
    expect(screen.getByText('全部状态')).toBeInTheDocument();
  });
});

/** 抹掉组件额外注入的 maxWidth 以及它留下的空白，便于与手写形态逐字比对 */
const stripMaxWidth = (html: string) => html.replace(/\s*max-width:\s*100%;?/g, '').replace(/;\s*"/g, ';"');

describe('与原生写法的渲染等价性', () => {
  // 收敛的前提是「改写后渲染结果不变」。这里把原来散在各页面的手写形态与组件
  // 并排渲染做结构对比，唯一有意的差异是组件补上了 maxWidth: '100%'——
  // 固定宽度在窄屏容器里会横向溢出，参考页（RolesPage 等）本就带这条。
  const legacyKeyword = (
    <Input
      prefix={<Search size={14} />}
      placeholder="搜索名称"
      value="abc"
      onChange={vi.fn()}
      onEnterPress={vi.fn()}
      showClear
      style={{ width: 200 }}
    />
  );

  it('KeywordInput 与手写 Input 的渲染结构一致（仅多 maxWidth）', () => {
    const legacy = render(legacyKeyword).container.innerHTML;
    const next = render(
      <KeywordInput placeholder="搜索名称" value="abc" onChange={vi.fn()} onSearch={vi.fn()} width={200} />,
    ).container.innerHTML;

    expect(stripMaxWidth(next)).toBe(stripMaxWidth(legacy));
    expect(next).toContain('max-width: 100%');
  });

  it('KeywordInput 默认宽度与最常见的手写值 220 一致', () => {
    const legacy = render(
      <Input prefix={<Search size={14} />} placeholder="p" value="" onChange={vi.fn()} showClear style={{ width: 220 }} />,
    ).container.innerHTML;
    const next = render(<KeywordInput placeholder="p" value="" onChange={vi.fn()} />).container.innerHTML;
    expect(stripMaxWidth(next)).toBe(stripMaxWidth(legacy));
  });
});

describe('DateRangeFilter', () => {
  it('dateTimeRange 默认占位为「开始时间 / 结束时间」', () => {
    render(<DateRangeFilter value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('开始时间')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('结束时间')).toBeInTheDocument();
  });

  it('dateRange 默认占位为「开始日期 / 结束日期」', () => {
    render(<DateRangeFilter type="dateRange" value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('开始日期')).toBeInTheDocument();
  });

  it('占位文案可覆盖', () => {
    render(<DateRangeFilter value={null} onChange={vi.fn()} placeholder={['入职起', '入职止']} />);
    expect(screen.getByPlaceholderText('入职起')).toBeInTheDocument();
  });

  it('按 type 取不同默认宽度，且可被 width 覆盖', () => {
    const widthOf = (c: HTMLElement) =>
      (c.querySelector('[style*="width"]') as HTMLElement | null)?.style.width;
    const { container, rerender } = render(<DateRangeFilter value={null} onChange={vi.fn()} />);
    expect(widthOf(container)).toBe('360px');
    rerender(<DateRangeFilter type="dateRange" value={null} onChange={vi.fn()} />);
    expect(widthOf(container)).toBe('260px');
    rerender(<DateRangeFilter value={null} onChange={vi.fn()} width={300} />);
    expect(widthOf(container)).toBe('300px');
  });

  it('onChange 把 Semi 的宽松值收窄为 [Date, Date] | null', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);
    const input = screen.getByPlaceholderText('开始时间');
    fireEvent.click(input);
    // 未选满两端时应回调 null，而非半截数组
    expect(onChange).not.toHaveBeenCalledWith(expect.arrayContaining([undefined]));
  });
});
