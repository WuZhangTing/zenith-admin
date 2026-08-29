import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({ db: { select: vi.fn() } }));
vi.mock('../../lib/logger', () => ({
  default: { fatal: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../messaging/notification-outbox.service', () => ({ notify: vi.fn() }));

import { db } from '../../db';
import logger from '../../lib/logger';
import { notify } from '../messaging/notification-outbox.service';
import { replayCrashSentinelsOnStartup } from './crash-report.service';

const dbMock = vi.mocked(db);
const notifyMock = vi.mocked(notify);
const loggerMock = vi.mocked(logger);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function sentinelJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'uncaughtException',
    message: 'boom',
    stack: 'Error: boom\n    at somewhere',
    crashedAt: '2026-08-29T10:00:00.000Z',
    pid: 123,
    uptimeSec: 42,
    nodeVersion: 'v24.0.0',
    ...overrides,
  });
}

let tmpDir: string;
let crashesDir: string;
let archivedDir: string;
const originalLogDir = process.env.LOG_DIR;

async function listNames(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

beforeEach(async () => {
  vi.clearAllMocks();
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'crash-report-'));
  crashesDir = path.join(tmpDir, 'crashes');
  archivedDir = path.join(crashesDir, 'archived');
  await mkdir(crashesDir, { recursive: true });
  process.env.LOG_DIR = tmpDir;
  dbMock.select.mockImplementation(() => selectChain([{ id: 1 }, { id: 2 }]));
  notifyMock.mockResolvedValue(1);
});

afterEach(async () => {
  if (originalLogDir === undefined) delete process.env.LOG_DIR;
  else process.env.LOG_DIR = originalLogDir;
  await rm(tmpDir, { recursive: true, force: true });
});

describe('replayCrashSentinelsOnStartup', () => {
  it('crashes 目录不存在时静默返回', async () => {
    process.env.LOG_DIR = path.join(tmpDir, 'never-crashed');
    await replayCrashSentinelsOnStartup();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('有效哨兵：结构化留痕 + 通知平台超管 + 归档', async () => {
    const name = 'crash-1756000000000-123.json';
    await writeFile(path.join(crashesDir, name), sentinelJson());

    await replayCrashSentinelsOnStartup();

    expect(loggerMock.error).toHaveBeenCalledWith(
      '[crash-report] 检测到上一次进程异常崩溃',
      expect.objectContaining({ sentinel: name, kind: 'uncaughtException', message: 'boom' }),
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith('ops.server.crashed', expect.objectContaining({
      recipients: [{ type: 'user', id: 1 }, { type: 'user', id: 2 }],
      vars: expect.objectContaining({
        kind: 'uncaughtException',
        message: 'boom',
        crashedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
        pid: 123,
        uptimeSec: 42,
      }),
      tenantId: null,
      link: '/system/log-viewer',
      dedupeKey: `server-crash:${name}`,
    }));
    expect(await listNames(crashesDir)).toEqual([]);
    expect(await listNames(archivedDir)).toEqual([name]);
  });

  it('notify 失败：保留哨兵不归档，下次启动重试', async () => {
    const name = 'crash-1756000000000-123.json';
    await writeFile(path.join(crashesDir, name), sentinelJson());
    notifyMock.mockRejectedValue(new Error('outbox unavailable'));

    await replayCrashSentinelsOnStartup();

    expect(await listNames(crashesDir)).toEqual([name]);
    expect(await listNames(archivedDir)).toEqual([]);
  });

  it('malformed 哨兵：不通知，直接归档避免每次启动重复失败', async () => {
    const name = 'crash-1756000000000-123.json';
    await writeFile(path.join(crashesDir, name), '{not valid json');

    await replayCrashSentinelsOnStartup();

    expect(notifyMock).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      '[crash-report] 崩溃哨兵解析失败，直接归档',
      expect.objectContaining({ file: name }),
    );
    expect(await listNames(archivedDir)).toEqual([name]);
  });

  it('无平台超管：只留日志，仍归档', async () => {
    dbMock.select.mockImplementation(() => selectChain([]));
    const name = 'crash-1756000000000-123.json';
    await writeFile(path.join(crashesDir, name), sentinelJson());

    await replayCrashSentinelsOnStartup();

    expect(notifyMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalled();
    expect(await listNames(archivedDir)).toEqual([name]);
  });

  it('超过单次通知上限：仅最新 20 条发通知，全部归档', async () => {
    const names: string[] = [];
    for (let i = 0; i < 22; i++) {
      const name = `crash-${1756000000000 + i}-1.json`;
      names.push(name);
      await writeFile(path.join(crashesDir, name), sentinelJson({ pid: i }));
    }

    await replayCrashSentinelsOnStartup();

    expect(notifyMock).toHaveBeenCalledTimes(20);
    const notifiedKeys = notifyMock.mock.calls.map(([, input]) => input.dedupeKey);
    // 最旧的 2 条不发通知
    expect(notifiedKeys).not.toContain(`server-crash:${names[0]}`);
    expect(notifiedKeys).not.toContain(`server-crash:${names[1]}`);
    expect(notifiedKeys).toContain(`server-crash:${names[21]}`);
    expect(await listNames(crashesDir)).toEqual([]);
    expect((await listNames(archivedDir)).length).toBe(22);
  });
});
