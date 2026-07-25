/**
 * CMS 站内 URL 规则 —— 静态文件名与之一一对应。
 *
 * 单独成文件（而非留在 cms-render.service）是为了让 cms-link.service 复用时
 * 不产生 render ↔ link 的循环依赖。`cms-render.service.ts` 已重新导出这三个函数，
 * 现有 `from './cms-render.service'` 的导入无需改动。
 */

export function channelUrl(baseUrl: string, path: string, page = 1): string {
  return page <= 1 ? `${baseUrl}/${path}/` : `${baseUrl}/${path}/index_${page}.html`;
}

export function tagUrl(baseUrl: string, slug: string, page = 1): string {
  return page <= 1 ? `${baseUrl}/tag/${slug}/` : `${baseUrl}/tag/${slug}/index_${page}.html`;
}

export function contentUrl(
  baseUrl: string,
  channelPath: string,
  content: { id: number; slug: string | null },
  bodyPage = 1,
): string {
  const base = content.slug ?? content.id;
  return bodyPage <= 1
    ? `${baseUrl}/${channelPath}/${base}.html`
    : `${baseUrl}/${channelPath}/${base}_${bodyPage}.html`;
}
