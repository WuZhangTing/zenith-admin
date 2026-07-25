import fs from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { recordCmsPublishArtifact } = vi.hoisted(() => ({ recordCmsPublishArtifact: vi.fn() }));
vi.mock('./cms-publish-artifact-tracker', () => ({ recordCmsPublishArtifact }));

import { pruneOrphanStaticFiles, resolveStaticFile, siteStaticDir } from './cms-static.service';

const SITE_CODE = 'prune-orphan-test';

async function seed(files: string[]): Promise<void> {
  for (const rel of files) {
    const abs = resolveStaticFile(SITE_CODE, rel)!;
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, `<html>${rel}</html>`);
  }
}

async function listAll(): Promise<string[]> {
  const dir = siteStaticDir(SITE_CODE);
  const walk = async (d: string, prefix = ''): Promise<string[]> => {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
    const out: string[] = [];
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...await walk(path.join(d, e.name), rel));
      else out.push(rel);
    }
    return out;
  };
  return (await walk(dir)).sort();
}

afterEach(async () => {
  vi.clearAllMocks();
  await fs.rm(siteStaticDir(SITE_CODE), { recursive: true, force: true });
});

describe('CMS 孤儿静态产物清扫', () => {
  it('删除本次未写入的文件，保留写入集合内的文件', async () => {
    await seed(['index.html', 'news/2024/1.html', 'news/1.html', 'news/index.html']);

    // 改归档规则后：新产物在 news/2024/，旧的 news/1.html 成为孤儿
    const kept = new Set(['index.html', 'news/2024/1.html', 'news/index.html']);
    await expect(pruneOrphanStaticFiles(SITE_CODE, kept)).resolves.toBe(1);

    expect(await listAll()).toEqual(['index.html', 'news/2024/1.html', 'news/index.html']);
  });

  it('清扫后回收空目录，不残留空壳', async () => {
    await seed(['index.html', 'news/2023/9.html']);

    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set(['index.html']))).resolves.toBe(1);

    expect(await listAll()).toEqual(['index.html']);
    // 2023/ 与 news/ 均已随之回收
    await expect(fs.readdir(path.join(siteStaticDir(SITE_CODE), 'news'))).rejects.toThrow();
  });

  it('非默认通道子树同样纳入清扫范围', async () => {
    await seed(['__h5/news/1.html', '__h5/news/2024/1.html']);

    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set(['__h5/news/2024/1.html']))).resolves.toBe(1);

    expect(await listAll()).toEqual(['__h5/news/2024/1.html']);
  });

  it('写入集合覆盖全部文件时不做任何删除', async () => {
    const files = ['index.html', 'news/index.html'];
    await seed(files);

    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set(files))).resolves.toBe(0);

    expect(await listAll()).toEqual(files.sort());
    expect(recordCmsPublishArtifact).not.toHaveBeenCalled();
  });

  it('每个被删文件都落一条 deleted 产物记录，保证可审计', async () => {
    await seed(['a.html', 'b.html']);

    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set())).resolves.toBe(2);

    expect(recordCmsPublishArtifact).toHaveBeenCalledTimes(2);
    expect(recordCmsPublishArtifact).toHaveBeenCalledWith({ relPath: 'a.html', status: 'deleted' });
    expect(recordCmsPublishArtifact).toHaveBeenCalledWith({ relPath: 'b.html', status: 'deleted' });
  });

  it('目录不存在时安全返回 0（站点从未发布过）', async () => {
    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set(['index.html']))).resolves.toBe(0);
  });

  // 回归：写入侧记的是 URL 形态（`news/`、``），磁盘上却是 `news/index.html`、`index.html`。
  // 归一化若不复用 pathToStaticFile，首页与所有栏目页会被误判成孤儿删光。
  it('URL 形态的目录路径与磁盘 index.html 视为同一文件', async () => {
    await seed(['index.html', 'news/index.html', 'tag/release/index.html', 'news/1.html']);

    const kept = new Set(['', 'news/', 'tag/release/']);
    await expect(pruneOrphanStaticFiles(SITE_CODE, kept)).resolves.toBe(1);

    expect(await listAll()).toEqual(['index.html', 'news/index.html', 'tag/release/index.html']);
  });

  it('非默认通道的目录形态路径同样正确归一', async () => {
    await seed(['__h5/index.html', '__h5/news/index.html', '__h5/stale.html']);

    await expect(pruneOrphanStaticFiles(SITE_CODE, new Set(['__h5/', '__h5/news/']))).resolves.toBe(1);

    expect(await listAll()).toEqual(['__h5/index.html', '__h5/news/index.html']);
  });
});

describe('CMS 孤儿清扫的接线约束', () => {
  it('仅在未断点续跑时清扫（续跑集合不完整，误删将丢失有效产物）', async () => {
    const text = await readFile(new URL('./cms-static.service.ts', import.meta.url), 'utf8');
    expect(text).toMatch(/if \(resumeAfterKey == null\) \{[\s\S]{0,200}?pruneOrphanStaticFiles\(site\.code, written\)/);
  });

  it('取消构建的提前返回一律不清扫', async () => {
    const text = await readFile(new URL('./cms-static.service.ts', import.meta.url), 'utf8');
    // 所有 report(...) 触发的提前返回都必须是 pruned: 0
    const earlyReturns = text.match(/\)\) return \{ pages[^}]*\}/g) ?? [];
    expect(earlyReturns.length).toBeGreaterThan(0);
    for (const ret of earlyReturns) expect(ret).toContain('pruned: 0');
  });
});
