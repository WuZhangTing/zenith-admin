import sanitizeHtml from 'sanitize-html';
import { CMS_RESOURCE_URI_PREFIX } from '@zenith/shared';

/**
 * 素材句柄 scheme（`cms-res://{id}`）。
 *
 * 必须列入白名单：正文里的素材以句柄存储，而多条链路（站点导入、映射物化、
 * 分发同步、碎片改类型）会把**已落库的正文**再次送进净化器。若不放行，
 * sanitize-html 会把整个 `src`/`href` 属性丢掉，等于永久删除正文中的全部图片与媒体。
 * 句柄本身不可能承载脚本 —— 它只是 `cms-res://` 加数字，读取时才解析成真实 URL。
 */
const RESOURCE_URI_SCHEME = CMS_RESOURCE_URI_PREFIX.replace('://', '');

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'img', 'figure', 'figcaption',
  'video', 'audio', 'source',
] as const;

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  '*': ['class', 'style'],
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  video: ['src', 'poster', 'controls', 'preload', 'width', 'height'],
  audio: ['src', 'controls', 'preload'],
  source: ['src', 'type'],
};

// ─── 内联样式白名单 ───────────────────────────────────────────────────────────
//
// 不放行 style 的代价是「所见非所得」：富文本编辑器调的字号/颜色、碎片里写的
// 渐变横幅，落库时被静默抹掉（本仓 seed 的 home-banner 就是这样一存就变白板）。
// 放行 style ≠ 放行脚本：`<script>` 不在 allowedTags，且这里逐属性限定取值格式——
// 未列出的属性一律丢弃，列出的属性取值不匹配也丢弃。
//
// **有意不放行**：position / top / right / bottom / left / z-index / transform
// （可用来把元素浮到站点导航之上做点击劫持）、content、filter、animation、
// transition、behavior、-moz-binding（遗留浏览器的脚本执行面）。

/** 颜色：十六进制 / rgb(a) / hsl(a) / 关键字 */
const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|[a-z]{3,20})$/i;
/** 单个长度值（含无单位数字，供 line-height / opacity / flex 使用） */
const LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|pt|ch)?$/;
/** 长度简写：最多四段，允许 auto（margin: 0 auto） */
const LENGTH_LIST = /^(?:auto|-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|pt|ch)?)(?:\s+(?:auto|-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|pt|ch)?)){0,3}$/;
/** 边框简写：宽度 + 线型 + 颜色，顺序宽松 */
const BORDER = /^(?:(?:-?(?:\d+|\d*\.\d+)(?:px|em|rem)|thin|medium|thick)\s+)?(?:none|hidden|solid|dashed|dotted|double|groove|ridge)(?:\s+(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|[a-z]{3,20}))?$/i;
/**
 * 渐变：否定前瞻挡掉 url() / expression() / javascript: / -moz-binding 与反斜杠，
 * 再限制不得出现 `;` `{` `}`，杜绝从声明里越狱写出额外规则。
 *
 * 前瞻必须用 `[\s\S]*` 而非 `.*`：JS 正则的 `.` 不匹配行终止符，而 `[^;{}]*` 允许换行，
 * 于是 `linear-gradient(red,red)\n,url(https://evil/beacon.png)` 会让前瞻只扫第一行、
 * 后半段的 url() 完全不被检查却仍整体匹配。
 *
 * 反斜杠一并禁掉：CSS 转义序列 `\75 rl(` 在浏览器 tokenizer 里就是 `url(`，
 * 正则看到的字面量与浏览器最终执行的不是一回事。这是唯一允许 `\` 的白名单项，
 * 堵掉它等于关掉整个 CSS 转义入口。
 */
const GRADIENT = /^(?![\s\S]*(?:url\(|expression\(|javascript:|-moz-binding|\\))(?:repeating-)?(?:linear|radial|conic)-gradient\([^;{}]*\)$/i;
/** 背景：纯色或渐变（不放行 url()，避免外链追踪与旧浏览器的脚本面） */
const BACKGROUND = [COLOR, GRADIENT];

const keywords = (...words: string[]) => [new RegExp(`^(?:${words.join('|')})$`, 'i')];

const ALLOWED_STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
  '*': {
    // 排版
    color: [COLOR],
    'font-size': [LENGTH],
    'font-weight': keywords('normal', 'bold', 'bolder', 'lighter', '[1-9]00'),
    'font-style': keywords('normal', 'italic', 'oblique'),
    'font-family': [/^[\w\s,'"-]{1,120}$/],
    'line-height': [LENGTH],
    'letter-spacing': [LENGTH],
    'text-align': keywords('left', 'right', 'center', 'justify', 'start', 'end'),
    'text-decoration': keywords('none', 'underline', 'line-through', 'overline'),
    'text-indent': [LENGTH],
    'text-transform': keywords('none', 'uppercase', 'lowercase', 'capitalize'),
    'white-space': keywords('normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'),
    'word-break': keywords('normal', 'break-all', 'keep-all', 'break-word'),
    opacity: [LENGTH],
    // 盒模型
    margin: [LENGTH_LIST],
    'margin-top': [LENGTH_LIST], 'margin-right': [LENGTH_LIST],
    'margin-bottom': [LENGTH_LIST], 'margin-left': [LENGTH_LIST],
    padding: [LENGTH_LIST],
    'padding-top': [LENGTH_LIST], 'padding-right': [LENGTH_LIST],
    'padding-bottom': [LENGTH_LIST], 'padding-left': [LENGTH_LIST],
    width: [LENGTH_LIST], height: [LENGTH_LIST],
    'max-width': [LENGTH_LIST], 'max-height': [LENGTH_LIST],
    'min-width': [LENGTH_LIST], 'min-height': [LENGTH_LIST],
    'box-sizing': keywords('content-box', 'border-box'),
    'border-radius': [LENGTH_LIST],
    border: [BORDER], 'border-top': [BORDER], 'border-right': [BORDER],
    'border-bottom': [BORDER], 'border-left': [BORDER],
    'border-color': [COLOR], 'border-width': [LENGTH_LIST],
    'border-style': keywords('none', 'hidden', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge'),
    // 背景
    background: BACKGROUND,
    'background-color': [COLOR],
    'background-image': [GRADIENT],
    // 布局
    display: keywords('block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none', 'table', 'table-cell', 'table-row'),
    'flex-direction': keywords('row', 'row-reverse', 'column', 'column-reverse'),
    'flex-wrap': keywords('nowrap', 'wrap', 'wrap-reverse'),
    'justify-content': keywords('flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end'),
    'align-items': keywords('flex-start', 'flex-end', 'center', 'baseline', 'stretch', 'start', 'end'),
    gap: [LENGTH_LIST], 'row-gap': [LENGTH], 'column-gap': [LENGTH],
    'grid-template-columns': [/^(?:[\w\s.%()-]|,){1,120}$/],
    'vertical-align': keywords('baseline', 'top', 'middle', 'bottom', 'sub', 'super', 'text-top', 'text-bottom'),
    float: keywords('left', 'right', 'none'),
    clear: keywords('left', 'right', 'both', 'none'),
    overflow: keywords('visible', 'hidden', 'auto', 'scroll'),
    'list-style-type': keywords('none', 'disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'),
  },
};

const MEDIA_SCHEMES = ['http', 'https', RESOURCE_URI_SCHEME];

/** Sanitize untrusted rich text once at the server-side persistence boundary. */
export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', RESOURCE_URI_SCHEME],
    allowedSchemesByTag: {
      img: MEDIA_SCHEMES,
      video: MEDIA_SCHEMES,
      audio: MEDIA_SCHEMES,
      source: MEDIA_SCHEMES,
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
        },
      }),
    },
  });
}
