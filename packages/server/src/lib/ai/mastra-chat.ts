import { estimateTokens } from './tokens';
import { estimateMessageTokens, type ChatMessage, type StreamChunk } from './stream-types';
import { loadMastraAgentModule, buildModelChain, type ModelChainEntry } from './mastra-models';
import type { AiModelSettings } from '@zenith/shared/ai';

/**
 * Mastra Agent 聊天桥:动态 Agent + 模型降级链 + 工具循环,
 * 把 Mastra 流 chunk 映射回系统稳定的 SSE 协议(StreamChunk / tool_result)。
 */

export const STREAM_IDLE_TIMEOUT_MS = Number(process.env.AI_STREAM_IDLE_TIMEOUT_MS) || 90000;

/** 工具调用最多轮数(Agent maxSteps = 工具轮数 + 最终回答) */
const MAX_TOOL_ROUNDS = 5;

/** Mastra 工具形状(createTool 返回值,仅内部传递不展开) */
export type MastraToolsMap = Record<string, unknown>;

export type AgentChatChunk = StreamChunk
  | { type: 'tool_result'; name: string; arguments: string; result: string; durationMs: number };

export interface StreamAgentChatParams {
  /** 模型降级链(第一项为主模型) */
  chain: ModelChainEntry[];
  messages: ChatMessage[];
  systemPrompt?: string | null;
  /** Mastra 工具集(getMastraTools 产出);undefined/空 = 不启用工具 */
  tools?: MastraToolsMap;
  signal?: AbortSignal;
}

/** OpenAI 形状消息 → AI SDK ModelMessage(system 由 Agent instructions 承载,tool 角色消息由 Agent 内部管理) */
function toModelMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'tool' || m.role === 'system') continue;
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: m.content.map((p) => (p.type === 'image_url'
          ? { type: 'image', image: p.image_url?.url ?? '' }
          : { type: 'text', text: p.text ?? '' })),
      });
    } else {
      out.push({ role: m.role, content: m.content.map((p) => (p.type === 'text' ? p.text ?? '' : '')).join('') });
    }
  }
  return out;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'LLM API 调用失败';
}

/**
 * 流式对话:每次调用动态构建 Agent(instructions + 降级链 + 工具),
 * 工具执行与主备切换由 Mastra 内部完成。
 * - 空闲超时(默认 90s 无任何 chunk)自动中断
 * - 用户主动取消静默结束(由上层保存已生成内容)
 * - usage 缺失时按文本估算兜底
 */
export async function* streamAgentChat(params: StreamAgentChatParams): AsyncGenerator<AgentChatChunk> {
  const { Agent } = await loadMastraAgentModule();

  const abort = new AbortController();
  let idleTimedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idleTimedOut = true; abort.abort(); }, STREAM_IDLE_TIMEOUT_MS);
  };
  const onExternalAbort = () => abort.abort();
  if (params.signal) {
    if (params.signal.aborted) abort.abort();
    else params.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const pendingToolStarts = new Map<string, { name: string; args: string; startedAt: number }>();
  let outputText = '';
  let usageReported = false;

  try {
    const agent = new Agent({
      id: 'zenith-chat',
      name: 'Zenith Chat',
      instructions: params.systemPrompt?.trim() || '你是一个乐于助人的智能助手。',
      model: buildModelChain(params.chain),
      ...(params.tools && Object.keys(params.tools).length > 0 ? { tools: params.tools as never } : {}),
    });

    armIdle();
    const output = await agent.stream(toModelMessages(params.messages) as never, {
      abortSignal: abort.signal,
      maxSteps: MAX_TOOL_ROUNDS + 1,
    });

    for await (const chunk of output.fullStream as AsyncIterable<{ type: string; payload?: Record<string, unknown> }>) {
      armIdle();
      switch (chunk.type) {
        case 'text-delta': {
          const text = String((chunk.payload as { text?: string } | undefined)?.text ?? '');
          if (text) {
            outputText += text;
            yield { type: 'delta', content: text };
          }
          break;
        }
        case 'reasoning-delta': {
          const text = String((chunk.payload as { text?: string } | undefined)?.text ?? '');
          if (text) yield { type: 'reasoning', content: text };
          break;
        }
        case 'tool-call': {
          const p = chunk.payload as { toolCallId?: string; toolName?: string; args?: unknown } | undefined;
          if (p?.toolCallId) {
            pendingToolStarts.set(p.toolCallId, {
              name: p.toolName ?? 'unknown',
              args: JSON.stringify(p.args ?? {}),
              startedAt: Date.now(),
            });
          }
          break;
        }
        case 'tool-result': {
          const p = chunk.payload as { toolCallId?: string; toolName?: string; result?: unknown } | undefined;
          const started = p?.toolCallId ? pendingToolStarts.get(p.toolCallId) : undefined;
          if (p?.toolCallId) pendingToolStarts.delete(p.toolCallId);
          const result = typeof p?.result === 'string' ? p.result : JSON.stringify(p?.result ?? '');
          yield {
            type: 'tool_result',
            name: p?.toolName ?? started?.name ?? 'unknown',
            arguments: started?.args ?? '{}',
            result,
            durationMs: started ? Date.now() - started.startedAt : 0,
          };
          break;
        }
        case 'finish': {
          const p = chunk.payload as { output?: { usage?: { inputTokens?: number; outputTokens?: number } } } | undefined;
          const usage = p?.output?.usage;
          const tokensInput = usage?.inputTokens
            ?? params.messages.reduce((sum, m) => sum + estimateMessageTokens(m.content), 0);
          const tokensOutput = usage?.outputTokens ?? estimateTokens(outputText);
          usageReported = true;
          yield { type: 'done', tokensInput, tokensOutput };
          break;
        }
        case 'error': {
          const p = chunk.payload as { error?: unknown } | undefined;
          if (params.signal?.aborted) return; // 用户主动中断:静默
          yield { type: 'error', error: idleTimedOut ? 'AI 响应超时，请重试' : toErrorMessage(p?.error) };
          return;
        }
        case 'abort': {
          return; // 中断(用户取消或空闲超时中断后 Mastra 收尾),静默交由上层保存
        }
        default:
          break;
      }
    }

    // 流正常结束但未收到 finish(个别网关):按估算补 done
    if (!usageReported && !params.signal?.aborted && !idleTimedOut) {
      yield {
        type: 'done',
        tokensInput: params.messages.reduce((sum, m) => sum + estimateMessageTokens(m.content), 0),
        tokensOutput: estimateTokens(outputText),
      };
    }
  } catch (err) {
    if (params.signal?.aborted) return;
    if (idleTimedOut) {
      yield { type: 'error', error: 'AI 响应超时，请重试' };
      return;
    }
    if (err instanceof Error && err.name === 'AbortError') return;
    yield { type: 'error', error: toErrorMessage(err) };
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    if (params.signal) params.signal.removeEventListener('abort', onExternalAbort);
  }
}

export interface ChatOnceParams {
  chain: ModelChainEntry[];
  messages: ChatMessage[];
  systemPrompt?: string | null;
  /** 调用级设置覆盖(如标题生成用低温度) */
  modelSettings?: AiModelSettings;
  /** 总超时(毫秒),默认 60s */
  timeoutMs?: number;
}

export interface ChatOnceResult {
  content: string;
  tokensInput: number;
  tokensOutput: number;
}

/** 非流式一次性调用(标题生成 / 评测 / 报表解读等场景) */
export async function chatOnce(params: ChatOnceParams): Promise<ChatOnceResult> {
  const { Agent } = await loadMastraAgentModule();
  const agent = new Agent({
    id: 'zenith-chat-once',
    name: 'Zenith Chat Once',
    instructions: params.systemPrompt?.trim() || '你是一个乐于助人的智能助手。',
    model: buildModelChain(params.chain),
  });
  const result = await agent.generate(toModelMessages(params.messages) as never, {
    maxSteps: 1,
    modelSettings: {
      ...params.modelSettings,
      timeout: { totalMs: params.timeoutMs ?? 60_000 },
    },
  });
  const usage = (result as { totalUsage?: { inputTokens?: number; outputTokens?: number } }).totalUsage;
  const content = (result as { text?: string }).text ?? '';
  return {
    content,
    tokensInput: usage?.inputTokens
      ?? params.messages.reduce((sum, m) => sum + estimateMessageTokens(m.content), 0),
    tokensOutput: usage?.outputTokens ?? estimateTokens(content),
  };
}
