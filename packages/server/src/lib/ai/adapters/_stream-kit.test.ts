import { describe, expect, it, vi } from 'vitest';
import { createStreamAbort, extractApiError, fallbackTokens, iterateSseData, toStreamError } from './_stream-kit';
import type { ChatMessage } from './openai-compatible';

function sseStream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>, abort = createStreamAbort(undefined)) {
  const out: string[] = [];
  for await (const data of iterateSseData(stream, abort)) out.push(data);
  abort.cleanup();
  return out;
}

describe('extractApiError', () => {
  it('优先取 error.message', () => {
    expect(extractApiError('{"error":{"message":"配额不足"}}', 429, 'X 调用失败')).toBe('配额不足');
  });

  it('兼容 error 为字符串 / 顶层 message', () => {
    expect(extractApiError('{"error":"bad key"}', 401, 'X 调用失败')).toBe('bad key');
    expect(extractApiError('{"message":"上游异常"}', 500, 'X 调用失败')).toBe('上游异常');
  });

  it('无法解析时回落到带状态码的默认文案', () => {
    expect(extractApiError('<html>502</html>', 502, 'Gemini API 调用失败')).toBe('Gemini API 调用失败（HTTP 502）');
  });
});

describe('iterateSseData', () => {
  it('按行产出 data 负载，跳过非 data 行与空帧', async () => {
    const out = await drain(sseStream(
      'event: ping\n',
      'data: {"a":1}\n',
      'data:\n',
      ': comment\n',
      'data: [DONE]\n',
    ));
    expect(out).toEqual(['{"a":1}', '[DONE]']);
  });

  it('跨网络块的半行会被缓冲拼接', async () => {
    expect(await drain(sseStream('data: {"a":', '1}\n'))).toEqual(['{"a":1}']);
  });

  it('兼容 data 后无空格的写法', async () => {
    expect(await drain(sseStream('data:[DONE]\n'))).toEqual(['[DONE]']);
  });

  it('提前 break 时释放 reader 锁（可再次 getReader）', async () => {
    const stream = sseStream('data: 1\n', 'data: 2\n');
    const abort = createStreamAbort(undefined);
    for await (const _ of iterateSseData(stream, abort)) break;
    abort.cleanup();
    expect(() => stream.getReader()).not.toThrow();
  });
});

describe('createStreamAbort', () => {
  it('外部信号已中断时立即中断内部 controller', () => {
    const ac = new AbortController();
    ac.abort();
    const abort = createStreamAbort(ac.signal);
    expect(abort.signal.aborted).toBe(true);
    abort.cleanup();
  });

  it('外部中断会透传到内部 signal', () => {
    const ac = new AbortController();
    const abort = createStreamAbort(ac.signal);
    expect(abort.signal.aborted).toBe(false);
    ac.abort();
    expect(abort.signal.aborted).toBe(true);
    abort.cleanup();
  });

  it('空闲超时触发中断并标记 idleTimedOut', () => {
    vi.useFakeTimers();
    try {
      const abort = createStreamAbort(undefined, 100);
      abort.armIdle();
      expect(abort.idleTimedOut).toBe(false);
      vi.advanceTimersByTime(100);
      expect(abort.idleTimedOut).toBe(true);
      expect(abort.signal.aborted).toBe(true);
      abort.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it('armIdle 重置计时，持续有数据时不会超时', () => {
    vi.useFakeTimers();
    try {
      const abort = createStreamAbort(undefined, 100);
      abort.armIdle();
      vi.advanceTimersByTime(80);
      abort.armIdle();
      vi.advanceTimersByTime(80);
      expect(abort.idleTimedOut).toBe(false);
      abort.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanup 后空闲定时器不再触发', () => {
    vi.useFakeTimers();
    try {
      const abort = createStreamAbort(undefined, 100);
      abort.armIdle();
      abort.cleanup();
      vi.advanceTimersByTime(1000);
      expect(abort.idleTimedOut).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('toStreamError', () => {
  const base = { timeoutMessage: '超时了', fallbackMessage: '兜底文案' };

  it('用户主动中断时静默（返回 null）', () => {
    const ac = new AbortController();
    ac.abort();
    const abort = createStreamAbort(undefined);
    expect(toStreamError(new Error('x'), { signal: ac.signal, abort, ...base })).toBeNull();
    abort.cleanup();
  });

  it('空闲超时返回专用文案', () => {
    vi.useFakeTimers();
    try {
      const abort = createStreamAbort(undefined, 10);
      abort.armIdle();
      vi.advanceTimersByTime(10);
      expect(toStreamError(new Error('aborted'), { abort, ...base })).toEqual({ type: 'error', error: '超时了' });
      abort.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it('AbortError 静默', () => {
    const abort = createStreamAbort(undefined);
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(toStreamError(err, { abort, ...base })).toBeNull();
    abort.cleanup();
  });

  it('普通异常透出 message，非 Error 用兜底文案', () => {
    const abort = createStreamAbort(undefined);
    expect(toStreamError(new Error('ECONNRESET'), { abort, ...base })).toEqual({ type: 'error', error: 'ECONNRESET' });
    expect(toStreamError('boom', { abort, ...base })).toEqual({ type: 'error', error: '兜底文案' });
    abort.cleanup();
  });
});

describe('fallbackTokens', () => {
  const messages: ChatMessage[] = [{ role: 'user', content: 'hello world' }];

  it('上游已给出 usage 时原样保留', () => {
    expect(fallbackTokens({ tokensInput: 11, tokensOutput: 22 }, messages, ['ignored'])).toEqual({
      tokensInput: 11,
      tokensOutput: 22,
    });
  });

  it('缺失时按消息内容与产出文本估算', () => {
    const result = fallbackTokens({ tokensInput: 0, tokensOutput: 0 }, messages, ['some answer']);
    expect(result.tokensInput).toBeGreaterThan(0);
    expect(result.tokensOutput).toBeGreaterThan(0);
  });

  it('产出为空时不虚构输出 token', () => {
    expect(fallbackTokens({ tokensInput: 5, tokensOutput: 0 }, messages, ['', '']).tokensOutput).toBe(0);
  });

  it('支持自定义入参估算口径（vision 数组）', () => {
    const estimate = vi.fn().mockReturnValue(7);
    const result = fallbackTokens({ tokensInput: 0, tokensOutput: 0 }, messages, [''], estimate);
    expect(estimate).toHaveBeenCalledWith('hello world');
    expect(result.tokensInput).toBe(7);
  });
});
