import { httpRequest } from '../../http-client';
import { AI_SSRF_OPTIONS } from '../outbound';
import { createStreamAbort, extractApiError, fallbackTokens, iterateSseData, toStreamError } from './_stream-kit';
import type { StreamChatConfig, ChatMessage, StreamChunk } from './openai-compatible';

/** 把统一 ChatMessage 转为 Gemini contents 格式（system 走 systemInstruction） */
function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (typeof m.content === 'string') return { role, parts: [{ text: m.content }] };
      const parts = m.content.map((p) => {
        if (p.type === 'text') return { text: p.text ?? '' };
        const url = p.image_url?.url ?? '';
        const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(url);
        if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
        return { text: `[图片: ${url}]` };
      });
      return { role, parts };
    });
}

/**
 * Google Gemini 流式适配器（generateContent SSE：`:streamGenerateContent?alt=sse`）。
 * baseUrl 形如 `https://generativelanguage.googleapis.com/v1beta`（可含或不含 /v1beta，自动补全）。
 */
export async function* streamChatGemini(
  config: StreamChatConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  let base = config.baseUrl.replace(/\/$/, '');
  if (!/\/v1(beta)?$/.test(base)) base = `${base}/v1beta`;
  const url = `${base}/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse`;

  const abort = createStreamAbort(signal);

  let res;
  try {
    abort.armIdle();
    res = await httpRequest(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        ...(config.systemPrompt && { systemInstruction: { parts: [{ text: config.systemPrompt }] } }),
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: Number.parseFloat(config.temperature) || 0.7,
        },
      }),
      timeout: 0,
      retries: 1,
      signal: abort.signal,
      ...AI_SSRF_OPTIONS,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      yield { type: 'error', error: extractApiError(errText, res.status, 'Gemini API 调用失败') };
      abort.cleanup();
      return;
    }
  } catch (err: unknown) {
    abort.cleanup();
    const chunk = toStreamError(err, {
      signal, abort, timeoutMessage: '连接 AI 服务超时，请重试', fallbackMessage: 'Gemini API 调用失败',
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

  try {
    for await (const data of iterateSseData(body, abort)) {
      let parsed: {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        error?: { message?: string };
      };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // 忽略格式异常的 chunk
      }
      if (parsed.error?.message) {
        yield { type: 'error', error: parsed.error.message };
        return;
      }
      const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (text) {
        accumulated += text;
        yield { type: 'delta', content: text };
      }
      if (parsed.usageMetadata) {
        tokensInput = parsed.usageMetadata.promptTokenCount ?? tokensInput;
        tokensOutput = parsed.usageMetadata.candidatesTokenCount ?? tokensOutput;
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

  yield { type: 'done', ...fallbackTokens({ tokensInput, tokensOutput }, messages, [accumulated]) };
}
