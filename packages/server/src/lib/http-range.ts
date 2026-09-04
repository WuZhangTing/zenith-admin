import type { StoredFileRange } from './file-storage';
import { errBody } from './openapi-schemas';

/** 存储后端是否支持按字节区间读取；决定 `Accept-Ranges` 取值以及是否解析 `Range` 头 */
export function supportsRange(provider: string): boolean {
  return provider === 'local' || provider === 's3';
}

/**
 * 解析单区间 `Range: bytes=start-end` 头。
 * 无 Range 头返回 `null`；语法错误、区间为空、起点越界返回 `'invalid'`（应回 416）；
 * 末端超出文件长度时截断到最后一个字节。
 */
export function parseRangeHeader(rangeHeader: string | undefined, size: number): StoredFileRange | null | 'invalid' {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return 'invalid';
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return 'invalid';

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid';
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}

/** 416 Range Not Satisfiable：统一错误包络，`Content-Range` 只带文件总长度，附带调用方的缓存头 */
export function rangeNotSatisfiable(size: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(errBody('Range 不合法', 416)), {
    status: 416,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers, 'Content-Range': `bytes */${size}` },
  });
}

/** 整文件（200）或分片（206）响应的长度相关头 */
export function rangeContentHeaders(range: StoredFileRange | null, size: number): Record<string, string> {
  if (!range) return { 'Content-Length': String(size) };
  return {
    'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    'Content-Length': String(range.end - range.start + 1),
  };
}
