import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zenith-logviewer-'));
const logDir = path.join(tmpRoot, 'logs');
const extraRoot = path.join(tmpRoot, 'var-log');
const outside = path.join(tmpRoot, 'secret.env');

vi.mock('../../config', () => ({
  config: { log: { dir: logDir, viewerRoots: [extraRoot, '/var/log'] } },
}));
vi.mock('../../lib/host-exec', () => ({ getRemoteExecutor: vi.fn(), resolveExecutor: vi.fn() }));

const { resolveAllowedLogPath, getLocalLogRoots, getRemoteLogRoots } = await import('./log-viewer.service');

beforeAll(() => {
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(extraRoot, { recursive: true });
  fs.writeFileSync(path.join(logDir, 'app.log'), 'hello\n');
  fs.writeFileSync(path.join(extraRoot, 'syslog'), 'sys\n');
  fs.writeFileSync(outside, 'SECRET=1\n');
  try {
    fs.symlinkSync(outside, path.join(logDir, 'escape.log'));
  } catch { /* 无符号链接权限时跳过对应断言 */ }
});
afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

describe('日志查看器目录白名单（M4）', () => {
  it('白名单包含应用日志目录与配置目录', () => {
    expect(getLocalLogRoots()).toEqual(expect.arrayContaining([path.resolve(logDir), path.resolve(extraRoot)]));
    // 远端白名单只取 POSIX 绝对路径（Linux 下临时目录也以 / 开头，因此这里用包含判断）
    expect(getRemoteLogRoots()).toContain('/var/log');
    expect(getRemoteLogRoots().every((r) => r.startsWith('/'))).toBe(true);
  });

  it('允许白名单内的常规文件，返回真实路径', async () => {
    await expect(resolveAllowedLogPath(path.join(logDir, 'app.log'))).resolves.toBe(fs.realpathSync(path.join(logDir, 'app.log')));
    await expect(resolveAllowedLogPath(path.join(extraRoot, 'syslog'))).resolves.toBe(fs.realpathSync(path.join(extraRoot, 'syslog')));
  });

  it('拒绝白名单外的文件、路径穿越与相对路径', async () => {
    await expect(resolveAllowedLogPath(outside)).rejects.toMatchObject({ status: 403 });
    await expect(resolveAllowedLogPath(path.join(logDir, '..', 'secret.env'))).rejects.toMatchObject({ status: 403 });
    await expect(resolveAllowedLogPath('logs/app.log')).rejects.toMatchObject({ status: 400 });
    await expect(resolveAllowedLogPath(path.join(tmpRoot, 'nope', 'x.log'))).rejects.toMatchObject({ status: 403 });
  });

  it('白名单内不存在的文件返回 404，目录返回 400', async () => {
    await expect(resolveAllowedLogPath(path.join(logDir, 'missing.log'))).rejects.toMatchObject({ status: 404 });
    await expect(resolveAllowedLogPath(logDir)).rejects.toMatchObject({ status: 400 });
  });

  it('符号链接指向白名单外时被拒绝（按 realpath 判定）', async () => {
    if (!fs.existsSync(path.join(logDir, 'escape.log'))) return;
    await expect(resolveAllowedLogPath(path.join(logDir, 'escape.log'))).rejects.toMatchObject({ status: 403 });
  });

  it('远端路径按 POSIX 规范化后必须落在 LOG_VIEWER_ROOTS 内', async () => {
    await expect(resolveAllowedLogPath('/var/log/nginx/access.log', 7)).resolves.toBe('/var/log/nginx/access.log');
    await expect(resolveAllowedLogPath('/var/log/../../etc/shadow', 7)).rejects.toMatchObject({ status: 403 });
    await expect(resolveAllowedLogPath('/etc/shadow', 7)).rejects.toMatchObject({ status: 403 });
    await expect(resolveAllowedLogPath('/var/logs/x', 7)).rejects.toMatchObject({ status: 403 });
    await expect(resolveAllowedLogPath('var/log/syslog', 7)).rejects.toMatchObject({ status: 400 });
  });
});
