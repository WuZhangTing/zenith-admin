/** HTML 特殊字符转义，用于把动态文本安全地插入 HTML 文本与属性（邮件正文、打印页、SSR 片段） */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** 转义正则元字符，使任意字符串可安全拼入 `new RegExp()` 作为字面量匹配 */
export function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
