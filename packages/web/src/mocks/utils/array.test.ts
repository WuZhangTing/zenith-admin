import { describe, expect, it } from 'vitest';
import { removeWhere } from './array';

describe('removeWhere', () => {
  it('removes every matching item in place and returns the count', () => {
    const list = [
      { id: 1, group: 'keep' },
      { id: 2, group: 'remove' },
      { id: 3, group: 'remove' },
      { id: 4, group: 'keep' },
    ];

    expect(removeWhere(list, (item) => item.group === 'remove')).toBe(2);
    expect(list).toEqual([
      { id: 1, group: 'keep' },
      { id: 4, group: 'keep' },
    ]);
  });

  it('evaluates from the end so removals cannot skip adjacent matches', () => {
    const list = ['a', 'b', 'c'];
    const visitedIndexes: number[] = [];

    expect(removeWhere(list, (_item, index) => {
      visitedIndexes.push(index);
      return true;
    })).toBe(3);
    expect(visitedIndexes).toEqual([2, 1, 0]);
    expect(list).toEqual([]);
  });
});
