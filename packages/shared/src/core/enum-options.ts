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
