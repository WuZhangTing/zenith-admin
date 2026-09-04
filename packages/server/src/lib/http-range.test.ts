import { describe, expect, it } from 'vitest';
import { parseRangeHeader, rangeContentHeaders, rangeNotSatisfiable, supportsRange } from './http-range';

describe('supportsRange', () => {
  it('仅本地与 S3 存储支持字节区间读取', () => {
    expect(supportsRange('local')).toBe(true);
    expect(supportsRange('s3')).toBe(true);
    expect(supportsRange('oss')).toBe(false);
    expect(supportsRange('cos')).toBe(false);
  });
});

describe('parseRangeHeader', () => {
  const SIZE = 1000;

  it('无 Range 头返回 null', () => {
    expect(parseRangeHeader(undefined, SIZE)).toBeNull();
    expect(parseRangeHeader('', SIZE)).toBeNull();
  });

  it('解析 start-end、start- 与 -suffix 三种形态', () => {
    expect(parseRangeHeader('bytes=0-99', SIZE)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader('bytes=500-', SIZE)).toEqual({ start: 500, end: 999 });
    expect(parseRangeHeader('bytes=-100', SIZE)).toEqual({ start: 900, end: 999 });
  });

  it('末端越界时截断到最后一个字节', () => {
    expect(parseRangeHeader('bytes=900-5000', SIZE)).toEqual({ start: 900, end: 999 });
  });

  it('语法错误、空区间、起点越界、倒序区间均为 invalid', () => {
    expect(parseRangeHeader('bytes=abc', SIZE)).toBe('invalid');
    expect(parseRangeHeader('items=0-1', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=-', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=-0', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=1000-', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=50-10', SIZE)).toBe('invalid');
    expect(parseRangeHeader('bytes=0-99,200-299', SIZE)).toBe('invalid');
  });
});

describe('rangeContentHeaders', () => {
  it('整文件只带 Content-Length', () => {
    expect(rangeContentHeaders(null, 1000)).toEqual({ 'Content-Length': '1000' });
  });

  it('分片带 Content-Range 与分片长度', () => {
    expect(rangeContentHeaders({ start: 100, end: 199 }, 1000)).toEqual({
      'Content-Range': 'bytes 100-199/1000',
      'Content-Length': '100',
    });
  });
});

describe('rangeNotSatisfiable', () => {
  it('返回 416、统一错误包络与仅含总长度的 Content-Range，并透传调用方头', async () => {
    const res = rangeNotSatisfiable(1000, { 'Cache-Control': 'no-store' });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */1000');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ code: 416, message: 'Range 不合法' });
  });
});
