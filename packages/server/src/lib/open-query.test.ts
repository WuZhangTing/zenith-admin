import { describe, expect, it } from 'vitest';
import {
  decodeCmsOpenCursor,
  encodeCmsOpenCursor,
  OpenQueryError,
  parseCmsOpenExtendFilters,
  parseCmsOpenFields,
  parseCmsOpenIncludes,
  parseCmsOpenQuery,
  parseCmsOpenSort,
  pickCmsOpenFields,
} from './open-query';

describe('open-query DSL', () => {
  describe('排序', () => {
    it('默认按发布时间倒序，并以 id 补全序', () => {
      expect(parseCmsOpenSort(undefined)).toEqual([
        { field: 'publishedAt', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ]);
    });

    it('解析 +/- 前缀并自动补 id 保证全序', () => {
      expect(parseCmsOpenSort('-topWeight,+viewCount')).toEqual([
        { field: 'topWeight', direction: 'desc' },
        { field: 'viewCount', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ]);
    });

    it('已显式指定 id 时不重复追加', () => {
      expect(parseCmsOpenSort('+id')).toEqual([{ field: 'id', direction: 'asc' }]);
    });

    it('白名单外字段直接报错，而不是静默忽略', () => {
      expect(() => parseCmsOpenSort('searchVector')).toThrow(OpenQueryError);
      expect(() => parseCmsOpenSort('body')).toThrow(OpenQueryError);
      expect(() => parseCmsOpenSort('-createdBy')).toThrow(OpenQueryError);
    });
  });

  describe('字段裁剪', () => {
    it('未指定时返回 null（不裁剪）', () => {
      expect(parseCmsOpenFields('')).toBeNull();
    });

    it('始终保留 id，便于客户端对齐增量同步', () => {
      expect(parseCmsOpenFields('title,coverImage')).toEqual(['id', 'title', 'coverImage']);
    });

    it('白名单外字段报错', () => {
      expect(() => parseCmsOpenFields('title,searchVector')).toThrow(OpenQueryError);
      expect(() => parseCmsOpenFields('deletedAt')).toThrow(OpenQueryError);
    });

    it('pickCmsOpenFields 只输出白名单内且存在的字段，且始终保留 id', () => {
      const row = { id: 1, title: 't', body: 'b', viewCount: 3 };
      expect(pickCmsOpenFields(row, ['title'])).toEqual({ id: 1, title: 't' });
      expect(pickCmsOpenFields(row, ['id', 'title'])).toEqual({ id: 1, title: 't' });
      expect(pickCmsOpenFields(row, null)).toBe(row);
    });
  });

  describe('include', () => {
    it('解析合法项', () => {
      expect([...parseCmsOpenIncludes('tags,channel')]).toEqual(['tags', 'channel']);
    });

    it('非法项报错', () => {
      expect(() => parseCmsOpenIncludes('tags,secrets')).toThrow(OpenQueryError);
    });
  });

  describe('扩展字段过滤', () => {
    it('只识别 extend. 前缀', () => {
      expect(parseCmsOpenExtendFilters({ 'extend.price': '99', channel: 'news' }))
        .toEqual([{ field: 'price', value: '99' }]);
    });

    it('拒绝非法字段名（防 JSONB 路径注入）', () => {
      for (const key of ['extend.a.b', 'extend.a-b', "extend.a'b", 'extend.1a', 'extend.']) {
        expect(() => parseCmsOpenExtendFilters({ [key]: 'x' })).toThrow(OpenQueryError);
      }
    });

    it('拒绝超长过滤值', () => {
      expect(() => parseCmsOpenExtendFilters({ 'extend.a': 'x'.repeat(201) })).toThrow(OpenQueryError);
    });
  });

  describe('游标', () => {
    it('编解码可往返', () => {
      const cursor = { value: 1_700_000_000_000, id: 42 };
      expect(decodeCmsOpenCursor(encodeCmsOpenCursor(cursor))).toEqual(cursor);
    });

    it('支持空排序值（publishedAt 为 null 的行）', () => {
      const cursor = { value: null, id: 7 };
      expect(decodeCmsOpenCursor(encodeCmsOpenCursor(cursor))).toEqual(cursor);
    });

    it('空游标返回 null', () => {
      expect(decodeCmsOpenCursor(undefined)).toBeNull();
    });

    it('伪造/损坏的游标报错而不是被当成默认值', () => {
      for (const raw of ['not-base64!!', Buffer.from('a:b').toString('base64url'), Buffer.from('1:2:3').toString('base64url')]) {
        expect(() => decodeCmsOpenCursor(raw)).toThrow(OpenQueryError);
      }
    });
  });

  describe('整体解析', () => {
    it('pageSize 严格校验正整数并收敛到上限', () => {
      expect(() => parseCmsOpenQuery({ pageSize: '9999' })).toThrow(OpenQueryError);
      expect(() => parseCmsOpenQuery({ pageSize: '0' })).toThrow(OpenQueryError);
      expect(() => parseCmsOpenQuery({ pageSize: '1.5' })).toThrow(OpenQueryError);
      expect(() => parseCmsOpenQuery({ page: '-1' })).toThrow(OpenQueryError);
    });

    it('日期边界必须是有效且有序的日期', () => {
      expect(parseCmsOpenQuery({ publishedFrom: '2026-02-01', publishedTo: '2026-02-28' }).publishedFrom)
        .toBe('2026-02-01');
      expect(() => parseCmsOpenQuery({ publishedFrom: '2026-02-30' })).toThrow(OpenQueryError);
      expect(() => parseCmsOpenQuery({ publishedFrom: '2026-09-02', publishedTo: '2026-09-01' })).toThrow(OpenQueryError);
    });

    it('多值参数按逗号切分并去重', () => {
      const parsed = parseCmsOpenQuery({ channel: 'news,notice,news', tag: 'a' });
      expect(parsed.channels).toEqual(['news', 'notice']);
      expect(parsed.tags).toEqual(['a']);
    });

    it('布尔参数只接受 true/false/1/0', () => {
      expect(parseCmsOpenQuery({ isTop: 'true' }).flags.isTop).toBe(true);
      expect(parseCmsOpenQuery({ isTop: '0' }).flags.isTop).toBe(false);
      expect(parseCmsOpenQuery({}).flags.isTop).toBeUndefined();
      expect(() => parseCmsOpenQuery({ isTop: 'yes' })).toThrow(OpenQueryError);
    });

    it('关键词截断到 64 字符', () => {
      expect(parseCmsOpenQuery({ keyword: 'x'.repeat(100) }).keyword).toHaveLength(64);
    });

    it('内容形态白名单', () => {
      expect(parseCmsOpenQuery({ contentType: 'article,media' }).contentTypes).toEqual(['article', 'media']);
      expect(() => parseCmsOpenQuery({ contentType: 'secret' })).toThrow(OpenQueryError);
    });
  });
});
