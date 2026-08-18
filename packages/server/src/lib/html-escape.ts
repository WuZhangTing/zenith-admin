/** HTML 特殊字符转义，用于把动态文本安全地插入 HTML（邮件正文、确认页）。 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
