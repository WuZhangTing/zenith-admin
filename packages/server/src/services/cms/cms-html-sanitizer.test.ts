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

/**
 * 内联样式白名单。
 *
 * 不放行 style 的代价是「所见非所得」：富文本编辑器调的字号/颜色、碎片里写的渐变横幅，
 * 落库时被静默抹掉——本仓 seed 的 home-banner 就是一存就变白板。放行 style 不等于放行脚本：
 * `<script>` 不在 allowedTags，且逐属性限定取值格式，未列出的属性一律丢弃。
 */
describe('CMS 内联样式白名单', () => {
  const styleOf = (html: string) => /style="([^"]*)"/.exec(sanitizeCmsHtml(html))?.[1] ?? '';

  it('保留 seed 横幅的渐变排版（此前会被整段抹平）', () => {
    const banner = '<div style="padding:28px 24px;background:linear-gradient(120deg,#1f6feb,#0969da);border-radius:10px;color:#fff">x</div>';
    const style = styleOf(banner);
    expect(style).toContain('linear-gradient(120deg,#1f6feb,#0969da)');
    expect(style).toContain('border-radius:10px');
    expect(style).toContain('padding:28px 24px');
  });

  it.each([
    ['排版', '<p style="color:#333;font-size:14px;text-align:center;line-height:1.6">x</p>', ['color:#333', 'font-size:14px', 'text-align:center']],
    ['弹性布局', '<div style="display:flex;gap:12px;justify-content:space-between">x</div>', ['display:flex', 'gap:12px', 'justify-content:space-between']],
    ['居中容器', '<div style="margin:0 auto;max-width:960px">x</div>', ['margin:0 auto', 'max-width:960px']],
    ['边框简写', '<div style="border:1px solid #ddd;border-radius:8px">x</div>', ['border:1px solid #ddd', 'border-radius:8px']],
  ])('保留合法的 %s', (_label, html, expected) => {
    const style = styleOf(html);
    for (const fragment of expected) expect(style).toContain(fragment);
  });

  it.each([
    ['url() 背景（外链追踪 / 旧浏览器脚本面）', '<div style="background:url(https://evil.example/track.gif)">x</div>'],
    ['expression()（旧 IE 执行脚本）', '<div style="width:expression(alert(1))">x</div>'],
    ['behavior（旧 IE HTC）', '<div style="behavior:url(#default#time2)">x</div>'],
    ['-moz-binding（旧 Firefox XBL）', '<div style="-moz-binding:url(http://evil/x.xml#e)">x</div>'],
    ['position 定位（可覆盖站点导航做点击劫持）', '<div style="position:fixed;top:0;left:0;z-index:9999">x</div>'],
    ['transform 位移', '<div style="transform:translateY(-500px)">x</div>'],
    ['filter', '<div style="filter:blur(2px)">x</div>'],
  ])('丢弃 %s', (_label, html) => {
    expect(styleOf(html)).toBe('');
  });

  it('挡住从声明里越狱写出额外规则', () => {
    // color:red}body{display:none 若被原样保留，等于让碎片改写全站样式
    expect(styleOf('<div style="color:red}body{display:none">x</div>')).toBe('color:red');
  });

  it('放行 style 后脚本与事件属性依然被拦截', () => {
    const clean = sanitizeCmsHtml('<div style="color:red" onclick="alert(1)"><script>alert(2)</script>ok</div>');
    expect(clean).toBe('<div style="color:red">ok</div>');
  });

  it('样式净化保持幂等（存量正文会被反复送进净化器）', () => {
    const stored = '<div style="padding:16px;background:linear-gradient(90deg,#000,#fff)">x</div>';
    const once = sanitizeCmsHtml(stored);
    expect(sanitizeCmsHtml(once)).toBe(once);
  });
});
