/**
 * 流式 LLM 适配器公共脚手架。
 *
 * OpenAI 兼容 / Anthropic / Gemini 三个适配器的差异只在「请求怎么拼、chunk 怎么解」，
 * 而外围的**中断控制、空闲超时、SSE 分帧、错误信息提取、token 兜底估算**完全一致。
 * 此前三份各自复制，改一处漏两处（例如空闲超时时长、AbortError 静默规则）。
 */
import { estimateTokens } from '../tokens';
import type { ChatMessage, StreamChunk } from './openai-compatible';

export const STREAM_IDLE_TIMEOUT_MS = Number(process.env.AI_STREAM_IDLE_TIMEOUT_MS) || 90000;

/**
 * 中断控制器：把「外部取消信号」与「读流空闲超时」合并成一个 AbortSignal。
 *
 * - `armIdle()` 在每次发起请求 / 读到一帧后调用，重置空闲计时
 * - `cleanup()` 必须在结束路径调用，清理定时器与外部信号监听（否则泄漏）
 * - `idleTimedOut` 用于区分「用户主动取消」与「超时」，两者的用户可见反馈不同
 */
export function createStreamAbort(signal: AbortSignal | undefined, idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS) {
  const ac = new AbortController();
  let idleTimedOut = false;
  const onExternalAbort = () => ac.abort();
  if (signal) {
    if (signal.aborted) ac.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    signal: ac.signal,
    get idleTimedOut() { return idleTimedOut; },
    armIdle(): void {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { idleTimedOut = true; ac.abort(); }, idleTimeoutMs);
    },
    cleanup(): void {
      if (idleTimer) clearTimeout(idleTimer);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    },
  };
}

export type StreamAbort = ReturnType<typeof createStreamAbort>;

/**
 * 把异常归一成「要不要产出 error chunk」的决策：
 * 用户主动中断和 AbortError 一律静默（由上层保存已生成内容），空闲超时给出专用文案。
 *
 * @returns 需要产出的 error chunk；`null` 表示静默结束
 */
export function toStreamError(
  err: unknown,
  opts: { signal?: AbortSignal; abort: StreamAbort; timeoutMessage: string; fallbackMessage: string },
): Extract<StreamChunk, { type: 'error' }> | null {
  if (opts.signal?.aborted) return null;
  if (opts.abort.idleTimedOut) return { type: 'error', error: opts.timeoutMessage };
  if (err instanceof Error && err.name === 'AbortError') return null;
  return { type: 'error', error: err instanceof Error ? err.message : opts.fallbackMessage };
}

/** 从上游错误响应体中提取可读错误信息，取不到则回落到带状态码的默认文案 */
export function extractApiError(body: string, status: number, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'object' && parsed.error?.message) return parsed.error.message;
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.message) return parsed.message;
  } catch { /* ignore */ }
  return `${fallback}（HTTP ${status}）`;
}

/**
 * 逐帧读取 SSE 响应体，产出 `data:` 后的原始负载字符串（已 trim、已跳过空帧）。
 *
 * 每读到一个网络块就 `armIdle()` 重置空闲计时；调用方负责 `reader.releaseLock()` 之外的清理，
 * 本函数在结束（含异常）时释放 reader 锁。
 */
export async function* iterateSseData(
  body: ReadableStream<Uint8Array>,
  abort: StreamAbort,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      abort.armIdle();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 上游未返回 usage 时的 token 兜底估算（部分兼容网关不支持 usage 上报），
 * 保证用量统计有量级正确的数据。
 *
 * `estimateContent` 用于覆盖入参消息的估算口径：OpenAI 兼容适配器支持 vision 数组内容，
 * 需按片段类型分别计价（estimateMessageTokens）；Anthropic / Gemini 走默认的整体序列化估算。
 */
export function fallbackTokens(
  current: { tokensInput: number; tokensOutput: number },
  messages: readonly ChatMessage[],
  outputs: readonly string[],
  estimateContent: (content: ChatMessage['content']) => number = defaultEstimateContent,
): { tokensInput: number; tokensOutput: number } {
  let { tokensInput, tokensOutput } = current;
  if (!tokensInput) {
    tokensInput = messages.reduce((sum, m) => sum + estimateContent(m.content), 0);
  }
  if (!tokensOutput && outputs.some(Boolean)) {
    tokensOutput = outputs.reduce((sum, text) => sum + estimateTokens(text), 0);
  }
  return { tokensInput, tokensOutput };
}

function defaultEstimateContent(content: ChatMessage['content']): number {
  return estimateTokens(typeof content === 'string' ? content : JSON.stringify(content));
}
