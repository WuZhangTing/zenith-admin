import { estimateTokens } from './tokens';

/**
 * 聊天流协议类型(SSE 对前端的稳定契约)。
 * 消息形状沿用 OpenAI 格式(历史消息构建、vision 图片、DB 存储均按此约定),
 * 模型调用层(Mastra)在内部完成到 AI SDK ModelMessage 的转换。
 */

/** vision 多模态内容片段（OpenAI 格式） */
export interface ChatMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

/** 工具调用（OpenAI 格式） */
export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatMessagePart[];
  /** assistant 消息携带的工具调用 */
  tool_calls?: ChatToolCall[];
  /** tool 结果消息对应的调用 ID */
  tool_call_id?: string;
}

export type StreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'tool_calls'; calls: ChatToolCall[] }
  | { type: 'done'; tokensInput: number; tokensOutput: number }
  | { type: 'error'; error: string };

/** 估算消息内容 token（兼容 vision 数组内容） */
export function estimateMessageTokens(content: string | ChatMessagePart[]): number {
  if (typeof content === 'string') return estimateTokens(content);
  return content.reduce((sum, p) => sum + (p.type === 'text' ? estimateTokens(p.text ?? '') : 200), 0);
}
