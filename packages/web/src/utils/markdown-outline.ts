/**
 * Markdown 标题大纲提取：为阅读视图提供目录（TOC）。
 * slug 规则与 MarkdownPreviewPanel 的标题锚点注入保持一致（同一模块内维护），
 * id 不做去重——重复标题通过 occurrence 序号在 DOM 中定位第 N 个同名锚点。
 */

export interface MarkdownHeading {
  /** 标题层级（1-6，提取时按 maxLevel 截断） */
  level: number;
  /** 去除行内 Markdown 标记后的纯文本 */
  text: string;
  /** 锚点 id（不去重） */
  id: string;
  /** 同 id 第几次出现（0 起） */
  occurrence: number;
}

/** 行内 Markdown 标记转纯文本（代码、加粗、斜体、链接、图片） */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
  return slug || 'heading';
}

/** 提取 Markdown 标题（跳过 ``` / ~~~ 代码块内的 # 行） */
export function extractMarkdownHeadings(content: string, maxLevel = 3): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const occurrences = new Map<string, number>();
  let inCodeFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level > maxLevel) continue;
    const text = stripInlineMarkdown(match[2]);
    if (!text) continue;
    const id = slugifyHeading(text);
    const occurrence = occurrences.get(id) ?? 0;
    occurrences.set(id, occurrence + 1);
    headings.push({ level, text, id, occurrence });
  }
  return headings;
}
