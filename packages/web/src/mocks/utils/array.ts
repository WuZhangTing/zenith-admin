export function removeWhere<T>(
  list: T[],
  predicate: (item: T, index: number) => boolean,
): number {
  let removed = 0;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (predicate(list[index], index)) {
      list.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}
