import type { CmsFragmentType } from '@zenith/shared';
import { HTTPException } from 'hono/http-exception';
import { sanitizeCmsHtml } from './cms-html-sanitizer';

const fragmentTypes = new Set<CmsFragmentType>(['html', 'text', 'image']);

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
  return type === 'html' ? sanitizeCmsHtml(content) : content;
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

/**
 * 导入包里的碎片类型归一。
 *
 * `json` 类型已移除（无真实消费方，结构化配置由站点扩展模型承担），但旧导出包里仍可能带它。
 * 与 DB 迁移同一口径降级为 `text`，而不是让整包导入失败——包内其余内容与该碎片无关。
 * 未知类型同样回落到 `html` 默认值，保持导入的宽容度。
 */
export function normalizeImportedCmsFragmentType(type: string | null | undefined): CmsFragmentType {
  if (type === 'json') return 'text';
  return fragmentTypes.has(type as CmsFragmentType) ? (type as CmsFragmentType) : 'html';
}
