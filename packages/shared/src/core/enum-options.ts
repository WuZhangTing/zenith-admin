export interface LabelOption<Value extends string> {
  value: Value;
  label: string;
}

export function createLabelOptions<const Value extends string>(
  values: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): LabelOption<Value>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

export function createLabelOptionsFromMap<const Value extends string>(
  labels: Readonly<Record<Value, string>>,
): LabelOption<Value>[] {
  return createLabelOptions(Object.keys(labels) as Value[], labels);
}

/**
 * 把宽类型输入（表单 / 查询串里的 `string`）收窄为枚举成员；不在集合内返回 undefined。
 * 用于把筛选控件的值交给按枚举声明的契约查询参数。
 */
export function enumValueOf<const Value extends string>(values: readonly Value[], input: unknown): Value | undefined {
  return (values as readonly unknown[]).includes(input) ? (input as Value) : undefined;
}