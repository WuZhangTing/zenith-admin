import { describe, expect, it } from 'vitest';
import { sanitizeCmsHtml } from './cms-html-sanitizer';

describe('CMS untrusted HTML sanitizer', () => {
  it('removes executable tags, event handlers and dangerous URL schemes', () => {
    const dirty = [
      '<script>alert(1)</script>',
      '<style>body{display:none}</style>',
      '<iframe src="https://evil.example"></iframe>',
      '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
      '<img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(1)">',
      '<a href="javascript:alert(1)" onclick="alert(2)">click</a>',
      '<p style="background:url(javascript:alert(3))">safe text</p>',
    ].join('');
    const clean = sanitizeCmsHtml(dirty);

    expect(clean).not.toMatch(/script|style=|iframe|svg|onerror|onclick|javascript:|data:/i);
    expect(clean).toContain('<p>safe text</p>');
  });

  it('keeps common rich-text markup and safe links', () => {
    const clean = sanitizeCmsHtml(
      '<h2>Title</h2><p><strong>Body</strong> <a href="https://example.com" target="_blank">link</a></p>',
    );
    expect(clean).toContain('<h2>Title</h2>');
    expect(clean).toContain('<strong>Body</strong>');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  /**
   * 站点导入、映射物化、分发同步、碎片改类型等链路会把**已落库**的正文再次送进净化器。
   * 正文里的素材是 `cms-res://{id}` 句柄，若 scheme 不在白名单，sanitize-html 会整个丢掉
   * src/href 属性 —— 等于每走一次这些链路就永久删掉正文中的全部图片与媒体。
   */
  it('preserves cms-res:// resource handles so re-sanitizing stored bodies keeps media', () => {
    const clean = sanitizeCmsHtml(
      '<p><img src="cms-res://5" alt="a"><a href="cms-res://7">附件</a>'
      + '<video src="cms-res://9" controls></video><audio src="cms-res://11" controls></audio>'
      + '<video><source src="cms-res://13" type="video/mp4"></video></p>',
    );
    expect(clean).toContain('src="cms-res://5"');
    expect(clean).toContain('href="cms-res://7"');
    expect(clean).toContain('src="cms-res://9"');
    expect(clean).toContain('src="cms-res://11"');
    expect(clean).toContain('src="cms-res://13"');
  });

  it('stays idempotent across repeated sanitize passes of a stored body', () => {
    const stored = '<p><img src="cms-res://5" alt="a"></p>';
    expect(sanitizeCmsHtml(sanitizeCmsHtml(sanitizeCmsHtml(stored)))).toBe(sanitizeCmsHtml(stored));
    expect(sanitizeCmsHtml(sanitizeCmsHtml(stored))).toContain('cms-res://5');
  });
});
