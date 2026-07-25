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
  content: { id: number; slug: string | null; staticPath?: string | null },
  bodyPage = 1,
): string {
  // 自定义静态路径优先：整条相对路径由运营指定，正文分页在扩展名前追加 _N
  const custom = content.staticPath?.trim();
  if (custom) {
    if (bodyPage <= 1) return `${baseUrl}/${custom}`;
    const dot = custom.lastIndexOf('.');
    return dot <= 0
      ? `${baseUrl}/${custom}_${bodyPage}`
      : `${baseUrl}/${custom.slice(0, dot)}_${bodyPage}${custom.slice(dot)}`;
  }
  const base = content.slug ?? content.id;
  return bodyPage <= 1
    ? `${baseUrl}/${channelPath}/${base}.html`
    : `${baseUrl}/${channelPath}/${base}_${bodyPage}.html`;
}
