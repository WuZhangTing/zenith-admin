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

  /**
   * 渐变白名单的绕过防线。
   *
   * 这条正则是**唯一**允许出现括号与任意内容的白名单项，所以它是整个样式白名单的
   * 主要攻击面。三类历史绕过必须一直挡住：
   *  1. 换行——JS 正则的 `.` 不匹配行终止符，而值本身允许换行，前瞻会只扫第一行；
   *  2. CSS 转义——`\75 rl(` 在浏览器 tokenizer 里等于 `url(`，正则看到的字面量
   *     与浏览器最终执行的不是一回事；
   *  3. **非 url() 的取 URL 函数**——`image-set('https://evil/x.png' 1x)` 等接受裸字符串，
   *     浏览器照样发请求（实测 Chrome / Edge 会真的发出去）。因此改用函数白名单，
   *     新增的 CSS 函数默认被拒，而不是等出事再补黑名单。
   *
   * 触发面不限于管理员：会员投稿正文（cms-contribution.service）走的是同一个净化器，
   * 正文最终由主题 dangerouslySetInnerHTML 输出到公开文章页，且前台没有 CSP 兜底。
   */
  it.each([
    ['换行', '<div style="background-image:linear-gradient(red,red)\n,url(https://evil.example/b.png)">x</div>'],
    ['回车', '<div style="background-image:linear-gradient(red,red)\r,url(https://evil.example/b.png)">x</div>'],
    ['CRLF', '<div style="background-image:linear-gradient(red,red)\r\n,url(https://evil.example/b.png)">x</div>'],
    ['行分隔符 U+2028', '<div style="background-image:linear-gradient(red,red)\u2028,url(https://evil.example/b.png)">x</div>'],
    ['CSS 转义 \\75 rl(', '<div style="background-image:linear-gradient(red,red),\\75 rl(https://evil.example/p.png)">x</div>'],
    ['CSS 转义大写', '<div style="background:linear-gradient(red,red),\\55 RL(https://evil/p.png)">x</div>'],
    ['换行后接 expression', '<div style="background:linear-gradient(red,red)\nexpression(alert(1))">x</div>'],
    ['image-set 单引号', '<div style="background-image:linear-gradient(red,red),image-set(\'https://evil/b.png\' 1x)">x</div>'],
    ['image-set 双引号', '<div style="background-image:linear-gradient(red,red),image-set(&quot;https://evil/b.png&quot; 1x)">x</div>'],
    ['-webkit-image-set', '<div style="background:linear-gradient(red,red),-webkit-image-set(\'https://evil/b.png\' 1x)">x</div>'],
    ['image-set + type()', '<div style="background:linear-gradient(red,red),image-set(\'https://evil/b.png\' type(\'image/png\'))">x</div>'],
    ['src()', '<div style="background:linear-gradient(red,red),src(\'https://evil/b.png\')">x</div>'],
    ['image()', '<div style="background:linear-gradient(red,red),image(\'//evil/b.png\')">x</div>'],
    ['element()', '<div style="background:linear-gradient(red,red),element(#x)">x</div>'],
    ['paint() worklet', '<div style="background:linear-gradient(red,red),paint(myworklet)">x</div>'],
    ['cross-fade() 套 image-set', '<div style="background:linear-gradient(red,red),cross-fade(image-set(\'https://evil/x.png\') 50%)">x</div>'],
    ['协议相对裸写', '<div style="background:linear-gradient(red,red),image-set(//evil/b.png 1x)">x</div>'],
    ['var() 间接引用', '<div style="background:linear-gradient(red,red),var(--x)">x</div>'],
    ['尚不存在的新函数', '<div style="background:linear-gradient(red,red),brand-new-fn(https)">x</div>'],
  ])('渐变值不可借 %s 引用外部资源', (_label, html) => {
    expect(styleOf(html)).toBe('');
  });

  it.each([
    ['线性渐变', '<div style="background:linear-gradient(120deg,#1f6feb,#0969da)">x</div>'],
    ['重复渐变多色标', '<div style="background-image:repeating-linear-gradient(45deg,#fff 0 10px,#eee 10px 20px)">x</div>'],
    ['径向渐变含 rgba', '<div style="background:radial-gradient(circle at 50% 50%, rgba(0,0,0,.6), transparent)">x</div>'],
    ['圆锥渐变', '<div style="background:conic-gradient(from 90deg,#f00,#00f)">x</div>'],
    ['turn 单位', '<div style="background:conic-gradient(from 0.25turn,#f00,#00f)">x</div>'],
    ['空格斜杠 rgb', '<div style="background:linear-gradient(to right, rgb(0 0 0 / 50%), rgb(255 255 255 / 80%))">x</div>'],
    ['hsl / hsla', '<div style="background:linear-gradient(hsl(200 50% 40%), hsla(0,0%,0%,.5))">x</div>'],
    ['calc 色标', '<div style="background:linear-gradient(red calc(10% + 2px), blue)">x</div>'],
    ['负角度', '<div style="background:linear-gradient(-45deg,#000,#fff)">x</div>'],
    ['多层渐变', '<div style="background:linear-gradient(red,red),linear-gradient(blue,blue)">x</div>'],
  ])('不误伤合法的 %s', (_label, html) => {
    expect(sanitizeCmsHtml(html)).toMatch(/gradient\(/);
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
