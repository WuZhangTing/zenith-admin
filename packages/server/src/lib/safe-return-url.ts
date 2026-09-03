/**
 * 提取安全回跳地址：仅允许站内路径，防开放重定向。
 * 用 WHATWG URL 解析而非字符串前缀判断——浏览器会把 `/\evil.com`、`/\/evil.com` 视作协议相对地址跳到外站，
 * 以占位 origin 解析后要求 origin 不变，再只取 pathname + search + hash。
 */
export function safeReturnUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(raw)) return '/';
  const base = 'http://return-url.invalid';
  try {
    const url = new URL(raw, base);
    if (url.origin !== base) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
