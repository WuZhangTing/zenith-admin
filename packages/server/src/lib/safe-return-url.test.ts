import { describe, expect, it } from 'vitest';
import { safeReturnUrl } from './safe-return-url';

describe('safeReturnUrl（CMS 前台表单回跳，防开放重定向）', () => {
  it('放行站内路径并保留 query / hash', () => {
    expect(safeReturnUrl('/news/1')).toBe('/news/1');
    expect(safeReturnUrl('/news/1?page=2#comments')).toBe('/news/1?page=2#comments');
    expect(safeReturnUrl('/')).toBe('/');
  });

  it('拒绝协议相对与反斜杠变体（浏览器会解析为外站）', () => {
    expect(safeReturnUrl('//evil.com/x')).toBe('/');
    expect(safeReturnUrl('/\\evil.com/x')).toBe('/');
    expect(safeReturnUrl('/\\/evil.com')).toBe('/');
    expect(safeReturnUrl('/\\\\evil.com')).toBe('/');
    expect(safeReturnUrl('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });

  it('拒绝绝对地址、非字符串、控制字符', () => {
    expect(safeReturnUrl('https://evil.com')).toBe('/');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/');
    expect(safeReturnUrl('news/1')).toBe('/');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl(['/x'])).toBe('/');
    expect(safeReturnUrl('/x\r\nLocation: https://evil.com')).toBe('/');
  });
});
