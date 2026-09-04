import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_CONFORMANCE_ALLOWLIST } from './api-conformance.allowlist';

/**
 * API 路径契约测试：web 以字面量书写的每一条请求 URL、MSW 的每一条 handler 路径，
 * 都必须对应服务端路由表中的真实端点。路由表来源是 server 契约测试锁定的快照
 * （`packages/server/src/__snapshots__/app.contract.test.ts.snap`）。
 *
 * 契约化调用（`api(op)` / `mock(op)`）由类型保证、不在扫描范围内；本测试守住的是仍以字面量
 * 书写 URL 的调用——写错端点在这里变红，而不是等到线上 404。
 * 已知且有明确原因的缺口登记在 `api-conformance.allowlist.ts`，修复后必须移除（由本测试强制）。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, '..');
const snapshotPath = path.resolve(webSrc, '../../server/src/__snapshots__/app.contract.test.ts.snap');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const METHOD_MAP: Record<string, Method> = {
  get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', postForm: 'POST', download: 'GET', getBlob: 'GET',
};

const HOOK_CALL = /\b(?:request|memberRequest|approvalRequest)\.(get|post|put|delete|patch|postForm|download|getBlob)\s*(?:<[^()]*?>)?\(\s*/g;
const MOCK_CALL = /\bhttp\.(get|post|put|delete|patch)\(\s*/g;

interface ServerRoute { method: Method; segments: string[] }
interface CallSite { method: Method; path: string; file: string }

function loadServerRoutes(): ServerRoute[] {
  const snap = fs.readFileSync(snapshotPath, 'utf8');
  return [...snap.matchAll(/^\s+"(GET|POST|PUT|PATCH|DELETE) (\/[^"]*)",?$/gm)].map((m) => ({
    method: m[1] as Method,
    segments: m[2].split('/').slice(1),
  }));
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(full) && !/\.test\.tsx?$/.test(full)) yield full;
  }
}

/** 读出调用括号后的第一个字符串 / 模板字面量（处理嵌套 `${}`） */
function readLiteral(src: string, index: number): string | null {
  const quote = src[index];
  if (quote !== "'" && quote !== '`' && quote !== '"') return null;
  let out = '';
  let depth = 0;
  for (let i = index + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote === '`' && ch === '$' && src[i + 1] === '{') { depth++; out += '${'; i++; continue; }
    if (depth > 0) { if (ch === '{') depth++; else if (ch === '}') depth--; out += ch; continue; }
    if (ch === '\\') { out += src[i + 1]; i++; continue; }
    if (ch === quote) return out;
    out += ch;
  }
  return null;
}

/** 把每个平衡的 `${...}` 压成 `${}`，避免占位符内部的 `?` / `/` 干扰路径切分 */
function maskHoles(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') { depth--; if (depth === 0) break; }
      }
      out += '${}';
      i = j;
    } else {
      out += raw[i];
    }
  }
  return out;
}

/** 去掉末尾紧接在单词字符后的 `${}`（拼接查询串的写法，如 `cleanup${query}`）；接在 `-` 等连接符后的是段内动态（`batch-${action}`） */
function stripTrailingHole(masked: string): string {
  const start = masked.lastIndexOf('${}');
  if (start <= 0 || masked[start - 1] === '/') return masked;
  const after = masked.slice(start + 3);
  if (after !== '' && !after.startsWith('?')) return masked;
  return /\w/.test(masked[start - 1]) ? masked.slice(0, start) : masked;
}

/**
 * 归一化为可比较路径：查询串截断；`${}` 独占一段或嵌在段内 → 参数段 `:p`；
 * MSW 的 `:name` 也归一为 `:p`。
 */
export function normalizePath(raw: string): string {
  return stripTrailingHole(maskHoles(raw))
    .split('?')[0]
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) => (seg.includes('${') || /^:[A-Za-z_]\w*$/.test(seg) ? ':p' : seg))
    .join('/');
}

function matches(routes: ServerRoute[], method: Method, webPath: string): boolean {
  const segments = webPath.split('/').slice(1);
  return routes.some((route) =>
    route.method === method
    && route.segments.length === segments.length
    && route.segments.every((serverSeg, i) => serverSeg.startsWith(':') || serverSeg === '*' || segments[i] === ':p' || serverSeg === segments[i]));
}

function scan(dir: string, callPattern: RegExp, skip?: (file: string) => boolean): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of walk(dir)) {
    const rel = path.relative(webSrc, file).replaceAll('\\', '/');
    if (skip?.(rel)) continue;
    // 去掉注释行（JSDoc 示例里的 request.get(...) 不是真实调用）
    const src = fs.readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    for (const m of src.matchAll(callPattern)) {
      const literal = readLiteral(src, m.index + m[0].length);
      if (literal === null || !literal.startsWith('/api')) continue;
      sites.push({ method: METHOD_MAP[m[1]], path: normalizePath(literal), file: rel });
    }
  }
  return sites;
}

function reportMisses(sites: CallSite[], routes: ServerRoute[], allowed: Set<string>): string[] {
  return sites
    .filter((s) => !matches(routes, s.method, s.path) && !allowed.has(`${s.method} ${s.path}`))
    .map((s) => `${s.method} ${s.path}  (${s.file})`);
}

// 全目录同步扫描：全量并行跑测试时磁盘争抢明显，放宽超时避免环境抖动误报
describe('API 路径契约（字面量 URL 必须存在于服务端路由表）', { timeout: 60_000 }, () => {
  const routes = loadServerRoutes();
  const allowed = new Set(API_CONFORMANCE_ALLOWLIST.map((e) => `${e.method} ${e.path}`));

  it('路由快照可读且非空', () => {
    expect(routes.length).toBeGreaterThan(1000);
  });

  it('web 请求调用', () => {
    const sites = scan(webSrc, HOOK_CALL, (file) => file.startsWith('mocks/'));
    expect(reportMisses(sites, routes, allowed)).toEqual([]);
  });

  it('MSW handler 路径', () => {
    const sites = scan(path.join(webSrc, 'mocks'), MOCK_CALL);
    expect(reportMisses(sites, routes, allowed)).toEqual([]);
  });

  it('允许清单中的条目仍是缺口（缺口补上后必须移出清单）', () => {
    const stale = API_CONFORMANCE_ALLOWLIST.filter((e) => matches(routes, e.method, e.path));
    expect(stale.map((e) => `${e.method} ${e.path}`)).toEqual([]);
  });
});

describe('normalizePath', () => {
  it('把模板占位归一为参数段并截断查询串', () => {
    expect(normalizePath('/api/tenants/${id}')).toBe('/api/tenants/:p');
    expect(normalizePath('/api/tenants${toQueryString(params)}')).toBe('/api/tenants');
    expect(normalizePath('/api/a/${id}/b?x=1')).toBe('/api/a/:p/b');
    expect(normalizePath('/api/a/${id}/items${toQueryString({ page })}')).toBe('/api/a/:p/items');
    expect(normalizePath('/api/workflows/engine/jobs/batch-${action}')).toBe('/api/workflows/engine/jobs/:p');
    expect(normalizePath('/api/roles/:id/menus')).toBe('/api/roles/:p/menus');
    expect(normalizePath("/api/log-files/${encodeURIComponent(filename ?? '')}/content${toQueryString(params)}")).toBe('/api/log-files/:p/content');
  });
});
