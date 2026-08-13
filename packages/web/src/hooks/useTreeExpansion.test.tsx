/**
 * useTreeExpansion 契约测试。
 *
 * 两条容易手抄错、且错了也不报错的规则：
 *  1. `isAllExpanded` 必须以「当前渲染的数据」为准 —— 传筛选后的数据时，全部命中项
 *     展开即算全展开，否则按钮显示「全部展开」但点了毫无变化（死按钮）。
 *  2. 无可展开行时一律为 false —— 否则数据清空后残留的展开 key 会让空表格显示「全部折叠」。
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { collectTreeKeys, isAllKeysExpanded, useTreeExpansion } from './useTreeExpansion';

interface Node {
  id: number;
  children?: Node[];
}

const tree: Node[] = [
  { id: 1, children: [{ id: 2, children: [{ id: 3 }] }] },
  { id: 4 },
];

describe('collectTreeKeys', () => {
  it('深度优先收集全部层级的 id', () => {
    expect(collectTreeKeys(tree)).toEqual([1, 2, 3, 4]);
  });

  it('空树返回空数组', () => {
    expect(collectTreeKeys([])).toEqual([]);
  });
});

describe('isAllKeysExpanded', () => {
  it('展开数达到全部 key 数时为 true', () => {
    expect(isAllKeysExpanded([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('部分展开时为 false', () => {
    expect(isAllKeysExpanded([1], [1, 2, 3])).toBe(false);
  });

  it('无可展开节点时为 false，即使仍残留旧的展开 key', () => {
    expect(isAllKeysExpanded([1, 2], [])).toBe(false);
    expect(isAllKeysExpanded([], [])).toBe(false);
  });

  // Semi Tree 的 expandedKeys 只收 string[]，与 Table 侧的 (string | number)[] 并存
  it('对字符串 key 同样适用（Semi Tree 场景）', () => {
    expect(isAllKeysExpanded(['__all__', '1'], ['__all__', '1'])).toBe(true);
    expect(isAllKeysExpanded(['__all__'], ['__all__', '1'])).toBe(false);
  });
});

describe('展开 / 折叠切换', () => {
  it('首次点击展开全部层级，再次点击全部折叠', () => {
    const { result } = renderHook(() => useTreeExpansion(tree));

    expect(result.current.isAllExpanded).toBe(false);

    act(() => { result.current.toggleExpandAll(); });
    expect(result.current.expandedRowKeys).toEqual([1, 2, 3, 4]);
    expect(result.current.isAllExpanded).toBe(true);

    act(() => { result.current.toggleExpandAll(); });
    expect(result.current.expandedRowKeys).toEqual([]);
    expect(result.current.isAllExpanded).toBe(false);
  });

  it('部分展开时仍视为未全部展开', () => {
    const { result } = renderHook(() => useTreeExpansion(tree));

    act(() => { result.current.onExpandedRowsChange([{ id: 1 }, { id: 2 }]); });

    expect(result.current.isAllExpanded).toBe(false);
  });
});

describe('isAllExpanded 的空数据兜底', () => {
  it('无可展开行时为 false，即使仍残留旧的展开 key', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: Node[] }) => useTreeExpansion(data),
      { initialProps: { data: tree } },
    );

    act(() => { result.current.toggleExpandAll(); });
    expect(result.current.isAllExpanded).toBe(true);

    // 筛选后无结果：展开 key 还在，但没有任何可折叠的行
    rerender({ data: [] });

    expect(result.current.expandedRowKeys).toEqual([1, 2, 3, 4]);
    expect(result.current.isAllExpanded).toBe(false);
  });
});

describe('onExpandedRowsChange', () => {
  it('默认读 id，并丢弃没有 id 的行', () => {
    const { result } = renderHook(() => useTreeExpansion(tree));

    act(() => { result.current.onExpandedRowsChange([{ id: 1 }, { name: '分组' }, { id: 4 }]); });

    expect(result.current.expandedRowKeys).toEqual([1, 4]);
  });

  it('未传行时清空展开态', () => {
    const { result } = renderHook(() => useTreeExpansion(tree));

    act(() => { result.current.toggleExpandAll(); });
    act(() => { result.current.onExpandedRowsChange(); });

    expect(result.current.expandedRowKeys).toEqual([]);
  });
});

describe('自定义 collectKeys / getRowKey', () => {
  interface GroupRow {
    _isGroup: true;
    key: string;
    children: { key: string }[];
  }
  const groups: GroupRow[] = [
    { _isGroup: true, key: 'group_a', children: [{ key: 'config_1' }] },
    { _isGroup: true, key: 'group_b', children: [{ key: 'config_2' }] },
  ];

  it('只把可展开的分组行计入全展开判定', () => {
    const { result } = renderHook(() => useTreeExpansion(groups, {
      collectKeys: (rows) => rows.map((row) => row.key),
      getRowKey: (row) => (row && typeof row === 'object' && '_isGroup' in row
        ? (row as GroupRow).key
        : undefined),
    }));

    act(() => { result.current.toggleExpandAll(); });

    expect(result.current.expandedRowKeys).toEqual(['group_a', 'group_b']);
    expect(result.current.isAllExpanded).toBe(true);
  });

  it('回传中的叶子行被 getRowKey 过滤掉', () => {
    const { result } = renderHook(() => useTreeExpansion(groups, {
      collectKeys: (rows) => rows.map((row) => row.key),
      getRowKey: (row) => (row && typeof row === 'object' && '_isGroup' in row
        ? (row as GroupRow).key
        : undefined),
    }));

    act(() => {
      result.current.onExpandedRowsChange([{ _isGroup: true, key: 'group_a' }, { key: 'config_1' }]);
    });

    expect(result.current.expandedRowKeys).toEqual(['group_a']);
  });
});
