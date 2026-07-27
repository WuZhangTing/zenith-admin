import type { CmsFragmentType } from '@zenith/shared';
import { HTTPException } from 'hono/http-exception';
import { sanitizeCmsHtml } from './cms-html-sanitizer';

const fragmentTypes = new Set<CmsFragmentType>(['html', 'text', 'image', 'json']);

export function sanitizeCmsFragmentContent(
  type: CmsFragmentType | string,
  content: unknown,
): string | null {
  if (!fragmentTypes.has(type as CmsFragmentType)) {
    throw new HTTPException(400, { message: '碎片类型无效' });
  }
  if (content === null || content === undefined) return null;
  if (typeof content !== 'string') {
    throw new HTTPException(400, { message: '碎片内容必须是字符串或 null' });
  }
  if (type === 'html') return sanitizeCmsHtml(content);
  if (type !== 'json') return content;
  try {
    return JSON.stringify(JSON.parse(content));
  } catch {
    throw new HTTPException(400, { message: 'JSON 碎片内容格式无效' });
  }
}

/**
 * 碎片改动是否影响前台渲染。
 *
 * 渲染上下文只取启用碎片的 `code → { type, content }`（见 `getFragmentMap`），
 * 因此只有这四个字段值得触发整站重建；name / remark 这类后台备注不该让整站重跑一遍。
 * 放在纯函数模块里，便于单测直接覆盖，不必拉起 db / redis。
 */
export function cmsFragmentRenderChanged(
  before: CmsFragmentRenderFields,
  after: CmsFragmentRenderFields,
): boolean {
  if (before.status !== 'enabled' && after.status !== 'enabled') return false;
  return before.code !== after.code
    || before.type !== after.type
    || before.status !== after.status
    || before.content !== after.content;
}

export interface CmsFragmentRenderFields {
  code: string;
  type: CmsFragmentType | string;
  status: string;
  content: string | null;
}

export const sanitizeCmsImportedFragment = sanitizeCmsFragmentContent;
