import { describe, expect, it } from 'vitest';
import {
  FLEX_COLUMN_DEFAULT_MIN_WIDTH,
  resolveFlexColumns,
  stripFlexColumnProps,
  type FlexColumnProps,
} from './table-flex-columns';

interface Row { id: number; name: string; status: string; createdAt: string }

const flexColumns = (): FlexColumnProps<Row>[] => [
  { title: '名称', dataIndex: 'name', minWidth: 200 },
  { title: '创建时间', dataIndex: 'createdAt', width: 180 },
  { title: '状态', dataIndex: 'status', width: 80, fixed: 'right' },
  { title: '操作', key: 'operation', width: 150, fixed: 'right' },
];

describe('resolveFlexColumns', () => {
  it('普通表格：弹性列不写 width，scroll.x = 固定列之和 + 弹性列 minWidth', () => {
    const result = resolveFlexColumns(flexColumns());
    expect(result.columns[0]).not.toHaveProperty('width');
    expect(result.columns[0]).not.toHaveProperty('minWidth');
    expect(result.columns[1].width).toBe(180);
    expect(result.scroll).toEqual({ x: 200 + 180 + 80 + 150 });
    expect(result.fallbackColumnLabel).toBeNull();
    expect(result.columnsTotalWidth).toBe(610);
  });

  it('页面传入的 scroll.x 被列宽之和覆盖并标记，scroll.y 原样保留', () => {
    const result = resolveFlexColumns(flexColumns(), { scroll: { x: 2000, y: 400 } });
    expect(result.scroll).toEqual({ x: 610, y: 400 });
    expect(result.ignoredScrollX).toBe(true);
    expect(resolveFlexColumns(flexColumns()).ignoredScrollX).toBe(false);
  });

  it('勾选列与展开列（hideExpandedColumn=false）各计 48', () => {
    const withSelection = resolveFlexColumns(flexColumns(), { rowSelection: { selectedRowKeys: [] } });
    expect(withSelection.scroll?.x).toBe(610 + 48);

    const hiddenSelection = resolveFlexColumns(flexColumns(), { rowSelection: { hidden: true } });
    expect(hiddenSelection.scroll?.x).toBe(610);

    const expand = () => null;
    expect(resolveFlexColumns(flexColumns(), { expandedRowRender: expand }).scroll?.x).toBe(610);
    expect(resolveFlexColumns(flexColumns(), { expandedRowRender: expand, hideExpandedColumn: false }).scroll?.x).toBe(658);
  });

  it('未声明弹性列时按启发式挑长文本列兜底，沿用其原 width 作为最小宽度并标记', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '名称', dataIndex: 'name', width: 220 },
      { title: '创建时间', dataIndex: 'createdAt', width: 180 },
      { title: '操作', key: 'operation', width: 150, fixed: 'right' },
    ];
    const result = resolveFlexColumns(columns);
    expect(result.fallbackColumnLabel).toBe('名称');
    expect(result.columns[0]).not.toHaveProperty('width');
    expect(result.scroll?.x).toBe(220 + 180 + 150);
  });

  it('弹性列未给 minWidth 时使用默认最小宽度', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '名称', dataIndex: 'name' },
      { title: '操作', key: 'operation', width: 150, fixed: 'right' },
    ];
    expect(resolveFlexColumns(columns).scroll?.x).toBe(FLEX_COLUMN_DEFAULT_MIN_WIDTH + 150);
  });

  it('非 fixed 布局（无 fixed / ellipsis / scroll.y）只剥离 minWidth，不改 scroll', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '名称', dataIndex: 'name', minWidth: 200 },
      { title: '状态', dataIndex: 'status', width: 80 },
    ];
    const result = resolveFlexColumns(columns, { scroll: { x: 900 } });
    expect(result.columns[0]).not.toHaveProperty('minWidth');
    expect(result.scroll).toEqual({ x: 900 });
    expect(result.ignoredScrollX).toBe(false);
    expect(result.columnsTotalWidth).toBe(0);
  });

  it('存在百分比宽度时不介入', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '名称', dataIndex: 'name', width: '60%' },
      { title: '状态', dataIndex: 'status', width: 80, fixed: 'right' },
    ];
    const result = resolveFlexColumns(columns);
    expect(result.columns[0].width).toBe('60%');
    expect(result.scroll).toBeUndefined();
  });

  it('虚拟化（fill）：弹性列得到显式宽度铺满 body 可视宽度，scroll.x 取容器宽度', () => {
    const result = resolveFlexColumns(flexColumns(), {
      scroll: { y: 500 },
      fill: { wrapperWidth: 1200, contentWidth: 1193 },
    });
    // 固定列 410 + 弹性列 minWidth 200 = 610；余量 583 全部给唯一弹性列
    expect(result.columns[0].width).toBe(200 + 583);
    expect(result.columnsTotalWidth).toBe(1193);
    expect(result.scroll).toEqual({ x: 1200, y: 500 });
  });

  it('虚拟化容器比列宽之和更窄时，弹性列保持 minWidth，由 body 横向滚动', () => {
    const result = resolveFlexColumns(flexColumns(), {
      scroll: { y: 500 },
      fill: { wrapperWidth: 500, contentWidth: 493 },
    });
    expect(result.columns[0].width).toBe(200);
    expect(result.columnsTotalWidth).toBe(610);
    expect(result.scroll?.x).toBe(500);
  });

  it('多个弹性列平分余量', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '名称', dataIndex: 'name', minWidth: 100 },
      { title: '状态', dataIndex: 'status', minWidth: 100 },
      { title: '操作', key: 'operation', width: 100, fixed: 'right' },
    ];
    const result = resolveFlexColumns(columns, { scroll: { y: 300 }, fill: { wrapperWidth: 500, contentWidth: 500 } });
    expect(result.columns.map((column) => column.width)).toEqual([200, 200, 100]);
  });

  it('分组表头：按叶子列求和并递归剥离 minWidth', () => {
    const columns: FlexColumnProps<Row>[] = [
      { title: '基本', children: [
        { title: '名称', dataIndex: 'name', minWidth: 200 },
        { title: '状态', dataIndex: 'status', width: 80 },
      ] },
      { title: '操作', key: 'operation', width: 150, fixed: 'right' },
    ];
    const result = resolveFlexColumns(columns);
    expect(result.scroll?.x).toBe(430);
    const group = result.columns[0] as FlexColumnProps<Row>;
    expect(group.children?.[0]).not.toHaveProperty('minWidth');
    expect(group.children?.[0]).not.toHaveProperty('width');
  });
});

describe('stripFlexColumnProps', () => {
  it('只剥离 minWidth，其余属性原样保留', () => {
    const result = stripFlexColumnProps(flexColumns());
    expect(result[0]).toEqual({ title: '名称', dataIndex: 'name' });
    expect(result[3]).toEqual({ title: '操作', key: 'operation', width: 150, fixed: 'right' });
  });
});
