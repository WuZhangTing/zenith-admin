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
  '*': ['class'],
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  video: ['src', 'poster', 'controls', 'preload', 'width', 'height'],
  audio: ['src', 'controls', 'preload'],
  source: ['src', 'type'],
};

const MEDIA_SCHEMES = ['http', 'https', RESOURCE_URI_SCHEME];

/** Sanitize untrusted rich text once at the server-side persistence boundary. */
export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
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
