import type { Context } from 'hono';
import { stream } from 'hono/streaming';
import type { StreamHandle } from './host-exec';

/**
 * 把长驻子进程（tail -f、journalctl -f 等）的输出转发为 HTTP 流式响应。
 * 写入串行化避免并发 write 交错；客户端断开时终止进程，进程退出时结束响应。
 *
 * @param spawn 启动进程：`onData` 收到每块输出，`onExit` 在进程结束时调用；返回可 kill 的句柄。
 */
export function streamProcessOutput(
  c: Context,
  spawn: (onData: (chunk: string) => void, onExit: () => void) => Promise<StreamHandle>,
): Response {
  return stream(c, async (s) => {
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    let aborted = false;
    let handle: StreamHandle | null = null;
    let writes = Promise.resolve();
    s.onAbort(() => {
      aborted = true;
      handle?.kill();
      finish();
    });
    handle = await spawn(
      (chunk) => {
        writes = writes
          .then(async () => { await s.write(chunk); })
          .catch(() => { handle?.kill(); finish(); });
      },
      () => { void writes.finally(finish); },
    );
    if (aborted) handle.kill();
    try {
      await done;
      await writes;
    } finally {
      handle.kill();
    }
  });
}
