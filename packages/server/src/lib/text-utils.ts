export function trimNullableText(value: unknown, maxLength = 512): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}
