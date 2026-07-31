import { httpRequest } from '../../http-client';
import { AI_SSRF_OPTIONS } from '../outbound';
import { createStreamAbort, extractApiError, fallbackTokens, iterateSseData, toStreamError } from './_stream-kit';
import type { StreamChatConfig, ChatMessage, StreamChunk } from './openai-compatible';

const ANTHROPIC_VERSION = '2023-06-01';

/** 把统一 ChatMessage（含 vision 数组内容）转为 Anthropic messages 格式；过滤 system/tool 角色（分别走 system 参数 / 仅 openai_compatible 支持） */
function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content };
      // vision 数组：text + image_url(data url) → Anthropic source.base64
      const parts = m.content.map((p) => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text ?? '' };
        const url = p.image_url?.url ?? '';
        const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(url);
        if (match) {
          return { type: 'image' as const, source: { type: 'base64' as const, media_type: match[1], data: match[2] } };
        }
        return { type: 'image' as const, source: { type: 'url' as const, url } };
      });
      return { role: m.role, content: parts };
    });
}

/**
 * Anthropic Messages API 流式适配器（/v1/messages + x-api-key）。
 * SSE 事件：message_start（input usage）→ content_block_delta（text_delta / thinking_delta）
 * → message_delta（output usage）→ message_stop。
 */
export async function* streamChatAnthropic(
  config: StreamChatConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const base = config.baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;

  const abort = createStreamAbort(signal);

  let res;
  try {
    abort.armIdle();
    res = await httpRequest(url, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: Number.parseFloat(config.temperature) || 0.7,
        ...(config.systemPrompt && { system: config.systemPrompt }),
        messages: toAnthropicMessages(messages),
        stream: true,
      }),
      timeout: 0,
      retries: 1,
      signal: abort.signal,
      ...AI_SSRF_OPTIONS,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      yield { type: 'error', error: extractApiError(errText, res.status, 'Anthropic API 调用失败') };
      abort.cleanup();
      return;
    }
  } catch (err: unknown) {
    abort.cleanup();
    const chunk = toStreamError(err, {
      signal, abort, timeoutMessage: '连接 AI 服务超时，请重试', fallbackMessage: 'Anthropic API 调用失败',
    });
    if (chunk) yield chunk;
    return;
  }

  const body = res.raw.body;
  if (!body) {
    abort.cleanup();
    yield { type: 'error', error: '响应体为空' };
    return;
  }

  let tokensInput = 0;
  let tokensOutput = 0;
  let accumulated = '';
  let reasoningAccumulated = '';

  const finalTokens = () =>
    fallbackTokens({ tokensInput, tokensOutput }, messages, [accumulated, reasoningAccumulated]);

  try {
    for await (const data of iterateSseData(body, abort)) {
      let parsed: {
        type?: string;
        message?: { usage?: { input_tokens?: number; output_tokens?: number } };
        delta?: { type?: string; text?: string; thinking?: string };
        usage?: { output_tokens?: number };
        error?: { message?: string };
      };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // 忽略格式异常的 chunk
      }
      switch (parsed.type) {
        case 'message_start':
          tokensInput = parsed.message?.usage?.input_tokens ?? 0;
          break;
        case 'content_block_delta': {
          const d = parsed.delta;
          if (d?.type === 'text_delta' && d.text) {
            accumulated += d.text;
            yield { type: 'delta', content: d.text };
          } else if (d?.type === 'thinking_delta' && d.thinking) {
            reasoningAccumulated += d.thinking;
            yield { type: 'reasoning', content: d.thinking };
          }
          break;
        }
        case 'message_delta':
          if (parsed.usage?.output_tokens) tokensOutput = parsed.usage.output_tokens;
          break;
        case 'error':
          yield { type: 'error', error: parsed.error?.message ?? 'Anthropic 流式响应错误' };
          return;
        case 'message_stop':
          yield { type: 'done', ...finalTokens() };
          return;
        default:
          break;
      }
    }
  } catch (err: unknown) {
    const chunk = toStreamError(err, {
      signal, abort, timeoutMessage: 'AI 响应超时，请重试', fallbackMessage: '读取响应流失败',
    });
    if (chunk) yield chunk;
    return;
  } finally {
    abort.cleanup();
  }

  yield { type: 'done', ...finalTokens() };
}
