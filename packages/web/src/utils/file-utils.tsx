import { Icon } from '@iconify/react';
import { TOKEN_KEY } from '@zenith/shared/core';
import { config } from '@/config';
import { getFileIcon } from '@/utils/fileIcons';
import { resolveFileMimeType } from '@/utils/file-mime';

export { guessMimeTypeFromName, resolveFileMimeType } from '@/utils/file-mime';

/** 将字节数格式化为可读字符串（B / KB / MB / GB）*/
export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** 将相对路径拼接为完整可访问 URL */
export function getFileFullUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = config.apiBaseUrl || globalThis.location.origin;
  return `${base}${url}`;
}

/** MIME 类型 → vscode-icons 图标 ID（无法识别时返回 null，由调用方兜底） */
function getIconIdForMime(mimeType: string): string | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/svg+xml') return 'vscode-icons:file-type-svg';
  if (mime.startsWith('image/')) return 'vscode-icons:file-type-image';
  if (mime.startsWith('video/')) return 'vscode-icons:file-type-video';
  if (mime.startsWith('audio/')) return 'vscode-icons:file-type-audio';
  if (mime === 'application/pdf') return 'vscode-icons:file-type-pdf2';
  if (
    mime.includes('msword') || mime.includes('wordprocessingml') ||
    mime.includes('vnd.ms-word') || mime.includes('opendocument.text') || mime.includes('rtf')
  ) return 'vscode-icons:file-type-word';
  if (
    mime.includes('presentationml') || mime.includes('powerpoint') ||
    mime.includes('opendocument.presentation')
  ) return 'vscode-icons:file-type-powerpoint';
  if (mime === 'text/csv' || mime === 'application/csv' || mime === 'text/tab-separated-values') return 'vscode-icons:file-type-excel2';
  if (
    mime.includes('spreadsheetml') || mime.includes('excel') ||
    mime.includes('opendocument.spreadsheet') || mime.includes('apple.numbers') ||
    mime.includes('iwork-numbers')
  ) return 'vscode-icons:file-type-excel';
  if (isArchiveFile(mime)) return 'vscode-icons:file-type-zip';
  if (mime.startsWith('font/') || mime.includes('ttf') || mime.includes('woff') || mime.includes('opentype')) return 'vscode-icons:file-type-font';
  if (mime.includes('json')) return 'vscode-icons:file-type-json';
  if (mime.includes('javascript')) return 'vscode-icons:file-type-js-official';
  if (mime.includes('typescript')) return 'vscode-icons:file-type-typescript';
  if (mime.includes('html')) return 'vscode-icons:file-type-html';
  if (mime.includes('css')) return 'vscode-icons:file-type-css';
  if (mime.includes('xml')) return 'vscode-icons:file-type-xml';
  if (mime.includes('yaml')) return 'vscode-icons:file-type-yaml';
  if (mime === 'application/x-sh' || mime === 'text/x-shellscript') return 'vscode-icons:file-type-shell';
  if (mime.includes('sql')) return 'vscode-icons:file-type-sql';
  if (mime === 'text/markdown' || mime === 'text/x-markdown') return 'vscode-icons:file-type-markdown';
  if (mime === 'text/x-python' || mime === 'application/x-python-code') return 'vscode-icons:file-type-python';
  if (
    mime === 'application/x-msdownload' ||
    mime === 'application/vnd.microsoft.portable-executable' ||
    mime === 'application/x-executable' ||
    mime === 'application/x-msdos-program'
  ) return 'vscode-icons:file-type-binary';
  if (mime.startsWith('text/') || mime.includes('document')) return 'vscode-icons:file-type-text';
  return null;
}

/**
 * 根据 MIME 类型（及可选文件名）返回文件类型图标（vscode-icons 彩色图标，全站统一）。
 * 提供 fileName 时优先按扩展名精确匹配（覆盖数百种类型），MIME 作兜底。
 */
export function getFileTypeIcon(mimeType?: string | null, iconSize = 15, fileName?: string | null) {
  let iconId: string | null = null;
  if (fileName) {
    const byName = getFileIcon(fileName);
    if (byName !== 'vscode-icons:default-file') iconId = byName;
  }
  if (!iconId && mimeType) iconId = getIconIdForMime(mimeType);
  return (
    <Icon
      icon={iconId ?? 'vscode-icons:default-file'}
      width={iconSize}
      height={iconSize}
      style={{ flexShrink: 0 }}
      aria-hidden
    />
  );
}

/** 判断文件是否支持预览；MIME 缺失或为通用二进制类型时可按文件名回退。 */
export function canPreviewFile(
  mimeType: string | null | undefined,
  fileName?: string | null,
): boolean {
  const resolvedMimeType = resolveFileMimeType(mimeType, fileName);
  if (!resolvedMimeType) return false;
  return (
    resolvedMimeType.startsWith('image/') ||
    resolvedMimeType.startsWith('audio/') ||
    resolvedMimeType.startsWith('video/') ||
    resolvedMimeType === 'application/pdf' ||
    isSpreadsheetFile(resolvedMimeType) ||
    isWordFile(resolvedMimeType) ||
    isPresentationFile(resolvedMimeType) ||
    isMarkdownFile(resolvedMimeType) ||
    isPlainTextFile(resolvedMimeType) ||
    isArchiveFile(resolvedMimeType) ||
    isJsonFile(resolvedMimeType) ||
    isSvgFile(resolvedMimeType) ||
    isCodeFile(resolvedMimeType)
  );
}

/** 判断是否为 File Viewer Spreadsheet renderer 支持的表格。 */
export function isSpreadsheetFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/vnd.ms-excel' ||
    mime.startsWith('application/vnd.ms-excel.') ||
    mime.includes('spreadsheetml') ||
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    mime === 'text/tab-separated-values' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet-flat-xml' ||
    mime === 'application/vnd.apple.numbers' ||
    mime === 'application/x-iwork-numbers-sffnumbers'
  );
}

/** 判断是否为 File Viewer Word renderer 支持的文本文档。 */
export function isWordFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/msword' ||
    mime.startsWith('application/vnd.ms-word.') ||
    mime.includes('wordprocessingml') ||
    mime === 'application/vnd.oasis.opendocument.text' ||
    mime === 'application/rtf' ||
    mime === 'application/x-rtf' ||
    mime === 'text/rtf'
  );
}

/** 判断是否为 File Viewer Presentation/OpenDocument renderer 支持的演示文稿。 */
export function isPresentationFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/vnd.ms-powerpoint' ||
    mime.startsWith('application/vnd.ms-powerpoint.') ||
    mime.includes('presentationml') ||
    mime === 'application/vnd.oasis.opendocument.presentation'
  );
}

/** 判断是否为可预览的 Markdown 文件 */
export function isMarkdownFile(mimeType?: string | null): boolean {
  return mimeType === 'text/markdown' || mimeType === 'text/x-markdown';
}

/** 判断是否为可预览的纯文本文件（.txt） */
export function isPlainTextFile(mimeType?: string | null): boolean {
  return mimeType === 'text/plain';
}
/** 判断是否为可预览的 JSON 文件 */
export function isJsonFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return mime === 'application/json' || mime === 'text/json';
}
/** 判断是否为 SVG 图形文件 */
export function isSvgFile(mimeType?: string | null): boolean {
  return mimeType === 'image/svg+xml';
}
/**
 * 判断是否为可预览的代码/配置文件。
 * 概履： JS/TS、Python、CSS、HTML、XML、YAML、Shell、SQL 等常见文本格式。
 * JSON 并不包含在此（由 isJsonFile 单独处理）。
 */
export function isCodeFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/javascript' ||
    mime === 'text/javascript' ||
    mime === 'application/typescript' ||
    mime === 'text/typescript' ||
    mime === 'text/x-python' ||
    mime === 'application/x-python-code' ||
    mime === 'text/css' ||
    mime === 'text/html' ||
    mime === 'text/xml' ||
    mime === 'application/xml' ||
    mime === 'application/x-yaml' ||
    mime === 'text/yaml' ||
    mime === 'text/x-yaml' ||
    mime === 'application/x-sh' ||
    mime === 'text/x-shellscript' ||
    mime === 'application/sql' ||
    mime === 'text/x-sql'
  );
}
/** 判断是否为可预览的 ZIP 压缩包 */
export function isZipFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-zip'
  );
}

const ARCHIVE_MIME_TYPES = new Set([
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/x-gtar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-bzip-compressed-tar',
  'application/x-xz',
  'application/x-xz-compressed-tar',
  'application/x-lzma',
  'application/zstd',
  'application/x-zstd-compressed-tar',
  'application/vnd.ms-cab-compressed',
  'application/x-archive',
  'application/x-cpio',
  'application/x-iso9660-image',
  'application/x-xar',
  'application/x-lzh-compressed',
  'application/java-archive',
  'application/vnd.android.package-archive',
  'application/vnd.comicbook+zip',
  'application/vnd.comicbook-rar',
]);

/** 判断是否为 File Viewer Archive renderer 支持的压缩包。 */
export function isArchiveFile(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();
  return isZipFile(mime) || ARCHIVE_MIME_TYPES.has(mime);
}
/** 使用当前登录 token 获取受保护的文件内容，返回 Blob；绝对 URL（云存储直链）直接裸 fetch，不携带 token */
export async function fetchProtectedFile(url: string): Promise<Blob> {
  const isAbsolute = /^https?:\/\//.test(url);
  let response: Response;
  if (isAbsolute) {
    response = await fetch(url);
  } else {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    response = await fetch(`${config.apiBaseUrl}${url}`, { headers });
  }
  if (!response.ok) {
    throw new Error('文件读取失败');
  }
  return response.blob();
}

/** 从 `/api/files/{id}/content` 形态的 URL 中解析文件 ID；非该形态返回 null */
export function extractManagedFileId(url: string): string | null {
  const matched = /\/api\/files\/([0-9a-f-]{36})\/content/i.exec(url);
  return matched?.[1] ?? null;
}

/**
 * 获取托管文件内容 Blob（直链优先）：
 * 1. 能解析出文件 ID 时先调 access-url 换取直链（public/presigned 直连对象存储，卸载代理流量）
 * 2. 直链请求失败（CORS/过期等）或无法解析 ID 时，降级回原 URL 的代理读取
 */
export async function fetchManagedFileBlob(url: string): Promise<Blob> {
  const fileId = extractManagedFileId(url);
  if (fileId) {
    try {
      const { getFileAccessUrl } = await import('@/hooks/queries/files');
      const access = await getFileAccessUrl(fileId);
      if (access.url !== url) return await fetchProtectedFile(access.url);
    } catch {
      // 解析直链失败，降级走代理
    }
  }
  return fetchProtectedFile(url);
}
