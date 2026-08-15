/**
 * Theme API：主题开发的类型安全辅助入口。
 *
 * 主题代码只依赖本文件与 types.ts / _shared.tsx，禁止直接 import db 或 services/cms
 * （取数一律经由渲染管线注入的 CmsThemeDataApi）。
 */
import type { CmsHomeContext, CmsHomeTemplateDefinition, CmsHomeTemplateHandle, CmsRenderSite, CmsThemeDataApi } from './types';
import type { ComponentType, ReactNode } from 'react';

export type { CmsThemeDataApi, CmsThemeContentCollection, CmsThemeContentQuery, CmsModelFieldValue } from './types';
export { ModelFieldTable, MODEL_FIELD_TABLE_STYLES } from './_shared';

/**
 * 定义带声明式取数的首页模板：
 * `load()` 在渲染前执行（可 Promise.all 并发读多个栏目），返回值类型自动推导并注入 `data`。
 *
 * ```tsx
 * export const GovHome = defineHomeTemplate({
 *   load: async ({ cms }) => {
 *     const [yaowen, notices] = await Promise.all([
 *       cms.contents.list({ channelCode: 'yaowen', limit: 8 }),
 *       cms.contents.list({ channelCode: 'tzgg', limit: 6 }),
 *     ]);
 *     return { yaowen, notices };
 *   },
 *   Component: ({ ctx, data }) => <HomePage news={data.yaowen.list} notices={data.notices.list} />,
 * });
 * ```
 */
export function defineHomeTemplate<D>(def: {
  load?: (args: { cms: CmsThemeDataApi; site: CmsRenderSite; baseUrl: string }) => Promise<D>;
  Component: (props: CmsHomeContext & { data: D }) => ReactNode;
}): CmsHomeTemplateDefinition<D> {
  return def;
}

/** 渲染管线用：判定首页模板是否为定义体（带 load）而非普通组件 */
export function isHomeTemplateDefinition(
  tpl: ComponentType<CmsHomeContext> | CmsHomeTemplateHandle,
): tpl is CmsHomeTemplateHandle {
  return typeof tpl === 'object' && tpl !== null && 'Component' in tpl;
}
