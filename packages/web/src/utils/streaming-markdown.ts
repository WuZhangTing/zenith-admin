import remend from 'remend';

/**
 * 流式 markdown 自愈(remend):补全未闭合的粗体/斜体/行内代码/链接等,
 * 消除 AI 流式输出中途原始符号(** [ ` )闪现。
 * - 完整文本是 no-op,幂等安全;
 * - linkMode text-only:未闭合链接只显示文字,不生成无意义的占位 href。
 */
export function healStreamingMarkdown(text: string): string {
  if (!text) return text;
  return remend(text, { linkMode: 'text-only' });
}
