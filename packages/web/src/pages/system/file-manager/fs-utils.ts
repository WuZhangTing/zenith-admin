/**
 * 文件管理器纯函数工具集（无 React / 无副作用，localStorage 读写除外）。
 * 从 FileManagerPage 抽出以便单测覆盖：路径拼接、副本命名、名称校验、
 * 权限转换、MIME 判定等都是行为敏感、回归成本高的逻辑。
 */
import type { FsEntry } from './types';

/** 可在线编辑的文本类扩展名（无扩展名文件如 Dockerfile/.env 亦允许） */
const EDITABLE_EXTS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'json5', 'yaml', 'yml', 'xml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'c', 'h',
  'cpp', 'hpp', 'cs', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'bat', 'cmd', 'sql', 'ini', 'cfg', 'conf', 'config',
  'env', 'toml', 'properties', 'log', 'csv', 'tsv', 'svg', 'graphql', 'prisma', 'dockerfile', 'gitignore',
  'editorconfig', 'lock', 'txt~',
]);

/** 判断文件是否可在线编辑（文本类扩展名或无扩展名的常见配置文件） */
export function isEditableFile(name: string): boolean {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return true; // Dockerfile / Makefile / LICENSE 等无扩展名文件
  const ext = lower.slice(dot + 1);
  if (EDITABLE_EXTS.has(ext)) return true;
  // .env / .gitignore 等点开头文件
  return dot === 0;
}

/** 是否为可解压的压缩包 */
export function isArchive(name: string): boolean {
  return /\.(zip|tgz|tbz2?|txz|gz|tar|tar\.gz|tar\.bz2|tar\.xz)$/i.test(name);
}

/** 路径拼接（自动识别分隔符） */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir.replace(/[/\\]+$/, '')}${sep}${name}`;
}

/** 生成不冲突的「副本」名：name - 副本 / name - 副本 2 / …（保留扩展名） */
export function makeCopyName(name: string, taken: Set<string>): string {
  const dot = name.startsWith('.') ? -1 : name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? `${stem} - 副本${ext}` : `${stem} - 副本 ${i}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem} - 副本 ${Date.now()}${ext}`;
}

/** 名称非法字符校验（跨平台禁止路径分隔符；Windows 额外限制保留字符与结尾点/空格） */
export function validateEntryName(name: string, isWindows: boolean): string | null {
  if (!name.trim()) return '请输入名称';
  if (/[/\\]/.test(name)) return '名称不能包含 / 或 \\';
  if (isWindows) {
    if (/[<>:"|?*]/.test(name)) return 'Windows 名称不能包含 < > : " | ? *';
    if (/[. ]$/.test(name)) return 'Windows 名称不能以点或空格结尾';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) return '该名称是 Windows 保留名';
  }
  if (name === '.' || name === '..') return '名称不合法';
  return null;
}

/** 收藏夹 localStorage key */
export const FM_BOOKMARKS_KEY = 'fm-bookmarks';

export function loadBookmarks(): { name: string; path: string }[] {
  try {
    const raw = localStorage.getItem(FM_BOOKMARKS_KEY);
    const parsed = raw ? JSON.parse(raw) as { name: string; path: string }[] : [];
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function buildBreadcrumbs(p: string): { label: string; path: string }[] {
  if (!p || p === '/') return [{ label: '/', path: '/' }];
  const isWin = /^[A-Za-z]:/.test(p);
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
  const result: { label: string; path: string }[] = [];
  if (!isWin) result.push({ label: '/', path: '/' });
  let cur = isWin ? '' : '/';
  for (const part of parts) {
    cur = isWin && cur === '' ? `${part}\\` : `${cur.replace(/[/\\]+$/, '')}${sep}${part}`;
    result.push({ label: part, path: cur });
  }
  return result;
}

export function dialogTitle(mode: string | undefined): string {
  if (mode === 'rename') return '重命名';
  if (mode === 'newDir') return '新建文件夹';
  if (mode === 'newFile') return '新建文件';
  if (mode === 'move') return '移动到';
  if (mode === 'copy') return '复制到';
  if (mode === 'compress') return '压缩为 ZIP';
  if (mode === 'chmod') return '修改权限（chmod）';
  return '';
}

// ── 文件预览辅助 ──────────────────────────────────────────────────────────────

/** 非 SVG 图片扩展名（直接内联显示，不进 FilePreviewModal）*/
export const NON_SVG_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif']);

/** 文件扩展名 → MIME 类型映射 */
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/m4a', opus: 'audio/opus',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
  md: 'text/markdown', markdown: 'text/markdown',
  json: 'application/json',
  zip: 'application/zip', gz: 'application/x-gzip', tar: 'application/x-tar',
  ts: 'text/typescript', tsx: 'text/typescript', js: 'text/javascript', jsx: 'text/javascript',
  html: 'text/html', htm: 'text/html', css: 'text/css', xml: 'text/xml',
  yaml: 'text/yaml', yml: 'text/yaml', sh: 'application/x-sh', bash: 'application/x-sh', zsh: 'application/x-sh',
  sql: 'text/x-sql', py: 'text/x-python', rs: 'text/x-rust', rb: 'text/plain',
  txt: 'text/plain', log: 'text/plain', conf: 'text/plain', ini: 'text/plain', env: 'text/plain', toml: 'text/plain',
};

export function getFileMimeType(name: string): string | null {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

// ── 权限转换 ─────────────────────────────────────────────────────────────────

export function modeToOctal(mode: number): string { return mode.toString(8).padStart(3, '0'); }
export function octalToMode(v: string): number { const n = Number.parseInt(v, 8); return Number.isNaN(n) ? 0 : n; }

export function modeToSymbolic(mode: number): string {
  const bits = ['r', 'w', 'x'];
  return [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001]
    .map((m, i) => (mode & m) ? bits[i % 3] : '-').join('');
}

/** 将 rwxr-xr-x 格式的权限字符串转为八进制字符串 */
export function permStringToOctal(perm?: string): string {
  if (!perm) return '';
  const p = perm.replace(/^[dl-]/, '').slice(0, 9);
  const masks = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  let mode = 0;
  for (let i = 0; i < 9 && i < p.length; i++) if (p[i] !== '-') mode |= masks[i];
  return modeToOctal(mode);
}

// ── 杂项 ─────────────────────────────────────────────────────────────────────

/** 上传进度更新（纯函数，提取到组件外避免每次渲染重建） */
export function updateUploadPct(prev: { name: string; progress: number }[], idx: number, pct: number) {
  return prev.map((u, i) => (i === idx ? { ...u, progress: pct } : u));
}

/** 深度搜索结果弹窗标题（避免内联嵌套三元 / 嵌套模板字符串） */
export function searchResultTitle(results: FsEntry[] | null): string {
  if (!results) return '搜索结果';
  const suffix = results.length >= 200 ? '+' : '';
  return `搜索结果（${results.length}${suffix}）`;
}
