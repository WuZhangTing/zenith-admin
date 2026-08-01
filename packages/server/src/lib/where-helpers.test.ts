/**
 * 查询构造辅助函数单测（全局复用的 WHERE 合并 / LIKE 转义 / 关键字 / 时间范围 / 分页）。
 *
 * 覆盖：
 *  1. escapeLike：%、_、\ 元字符转义（防 LIKE 通配符注入），转义顺序正确（先 \ 再 % _）
 *  2. mergeWhere：双条件 and 合并、单条件透传、全空返回 undefined
 *  3. keywordCondition：空值短路、转义、多列 or、like/ilike 切换
 *  4. dateRangeConditions：末端含当天（纯日期取 23:59:59.999，不是 00:00:00）
 *  5. buildWhere：过滤 undefined、全空返回 undefined
 *  6. withPagination：LIMIT/OFFSET 换算
 */
import { describe, it, expect, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { PgColumn, PgSelect } from 'drizzle-orm/pg-core';
import {
  buildWhere,
  dateRangeConditions,
  escapeLike,
  keywordCondition,
  mergeWhere,
  withPagination,
} from './where-helpers';
import { users } from '../db/schema';

describe('escapeLike - LIKE 注入防护', () => {
  it('% 被转义', () => {
    expect(escapeLike('100%')).toBe(String.raw`100\%`);
  });

  it('_ 被转义', () => {
    expect(escapeLike('user_name')).toBe(String.raw`user\_name`);
  });

  it('反斜杠被转义', () => {
    expect(escapeLike('a\\b')).toBe(String.raw`a\\b`);
  });

  it('先转义反斜杠再转义通配符（顺序关键，避免双重转义）', () => {
    // 输入 \% → 期望 \\\%（原 \ 转成 \\，原 % 转成 \%）
    expect(escapeLike('\\%')).toBe('\\\\\\%');
  });

  it('普通字符串原样返回', () => {
    expect(escapeLike('zhang san')).toBe('zhang san');
  });

  it('恶意全匹配 payload 被中和', () => {
    expect(escapeLike('%%%')).toBe(String.raw`\%\%\%`);
  });
});

describe('mergeWhere', () => {
  const a = sql`1 = 1`;
  const b = sql`2 = 2`;

  it('双条件返回 and 合并（新对象）', () => {
    const merged = mergeWhere(a, b);
    expect(merged).toBeDefined();
    expect(merged).not.toBe(a);
    expect(merged).not.toBe(b);
  });

  it('仅 base → 返回 base 本身', () => {
    expect(mergeWhere(a, undefined)).toBe(a);
  });

  it('仅 extra → 返回 extra 本身', () => {
    expect(mergeWhere(undefined, b)).toBe(b);
  });

  it('全空 → undefined（不加 WHERE）', () => {
    expect(mergeWhere(undefined, undefined)).toBeUndefined();
  });
});

describe('keywordCondition', () => {
  const cols = [users.username, users.nickname] as unknown as PgColumn[];
  const dialect = new PgDialect();
  const toQuery = (condition: SQL | undefined) => dialect.sqlToQuery(condition!);

  it('空 / undefined / 纯空格关键字返回 undefined（不参与 WHERE）', () => {
    expect(keywordCondition('', cols)).toBeUndefined();
    expect(keywordCondition(undefined, cols)).toBeUndefined();
    expect(keywordCondition(null, cols)).toBeUndefined();
    expect(keywordCondition('   ', cols)).toBeUndefined();
  });

  it('列为空时返回 undefined', () => {
    expect(keywordCondition('abc', [])).toBeUndefined();
  });

  it('多列生成 or 匹配', () => {
    const { sql: text } = toQuery(keywordCondition('zhang', cols));
    expect(text).toContain(' or ');
    expect(text).toContain('"username"');
    expect(text).toContain('"nickname"');
  });

  it('单列不产生多余的 or', () => {
    expect(toQuery(keywordCondition('zhang', [cols[0]])).sql).not.toContain(' or ');
  });

  it('关键字先 trim 再匹配，且 LIKE 元字符被转义', () => {
    expect(toQuery(keywordCondition('  100%  ', [cols[0]])).params).toEqual([String.raw`%100\%%`]);
  });

  it('默认 like 区分大小写，mode=ilike 不区分', () => {
    expect(toQuery(keywordCondition('abc', [cols[0]], 'like')).sql).toContain(' like ');
    expect(toQuery(keywordCondition('abc', [cols[0]], 'ilike')).sql).toContain(' ilike ');
  });
});

describe('dateRangeConditions', () => {
  const col = users.createdAt as unknown as PgColumn;
  const dialect = new PgDialect();
  /** Drizzle 会按列类型把 Date 序列化成 ISO 字符串，这里取回时间戳做区间断言 */
  const boundOf = (condition: SQL) => new Date(dialect.sqlToQuery(condition).params[0] as string).getTime();
  const DAY = 24 * 60 * 60 * 1000;

  it('两端都为空时返回空数组', () => {
    expect(dateRangeConditions(col, undefined, undefined)).toEqual([]);
    expect(dateRangeConditions(col, '', '')).toEqual([]);
  });

  it('仅起始 / 仅结束时各返回一个条件', () => {
    expect(dateRangeConditions(col, '2026-08-01', undefined)).toHaveLength(1);
    expect(dateRangeConditions(col, undefined, '2026-08-01')).toHaveLength(1);
  });

  it('两端齐全返回两个条件（>= 与 <=）', () => {
    const [start, end] = dateRangeConditions(col, '2026-08-01', '2026-08-31');
    expect(dialect.sqlToQuery(start).sql).toContain('>=');
    expect(dialect.sqlToQuery(end).sql).toContain('<=');
  });

  it('同一天的纯日期范围覆盖整天，而非退化成零长度区间', () => {
    // 这是本 helper 存在的核心理由：此前部分 service 用 parseDateTimeInput 解析末端，
    // 「8/1 到 8/1」两端都会得到 00:00:00，区间长度为 0，整个 8 月 1 日的数据全被漏掉
    const [start, end] = dateRangeConditions(col, '2026-08-01', '2026-08-01');
    expect(boundOf(end) - boundOf(start)).toBe(DAY - 1);
  });

  it('跨天的纯日期范围末端仍含最后一天', () => {
    const [start, end] = dateRangeConditions(col, '2026-08-01', '2026-08-03');
    expect(boundOf(end) - boundOf(start)).toBe(3 * DAY - 1);
  });

  it('带时分秒时按原值解析，不做端点补齐', () => {
    const [start, end] = dateRangeConditions(col, '2026-08-01 10:00:00', '2026-08-01 10:30:00');
    expect(boundOf(end) - boundOf(start)).toBe(30 * 60 * 1000);
  });

  it('起始为纯日期、末端带时分秒时按各自口径解析', () => {
    const [start, end] = dateRangeConditions(col, '2026-08-01', '2026-08-01 12:00:00');
    expect(boundOf(end) - boundOf(start)).toBe(12 * 60 * 60 * 1000);
  });
});

describe('buildWhere', () => {
  const a = sql`1 = 1`;
  const b = sql`2 = 2`;

  it('无参数 / 全 undefined → undefined（不加 WHERE）', () => {
    expect(buildWhere()).toBeUndefined();
    expect(buildWhere(undefined, undefined)).toBeUndefined();
  });

  it('单条件原样透传，不包一层 and', () => {
    expect(buildWhere(undefined, a, undefined)).toBe(a);
  });

  it('多条件 and 合并', () => {
    const merged = buildWhere(a, undefined, b);
    expect(merged).toBeDefined();
    expect(merged).not.toBe(a);
    expect(merged).not.toBe(b);
  });

  it('可直接展开 dateRangeConditions 的返回值', () => {
    const col = users.createdAt as unknown as PgColumn;
    expect(buildWhere(a, ...dateRangeConditions(col, '2026-08-01', '2026-08-31'))).toBeDefined();
  });
});

describe('withPagination', () => {
  function fakeQb() {
    const qb = {
      limit: vi.fn(() => qb),
      offset: vi.fn(() => qb),
    };
    return qb;
  }

  it('page=1 → OFFSET 0', () => {
    const qb = fakeQb();
    withPagination(qb as unknown as PgSelect, 1, 10);
    expect(qb.limit).toHaveBeenCalledWith(10);
    expect(qb.offset).toHaveBeenCalledWith(0);
  });

  it('page=3, pageSize=20 → LIMIT 20 OFFSET 40', () => {
    const qb = fakeQb();
    withPagination(qb as unknown as PgSelect, 3, 20);
    expect(qb.limit).toHaveBeenCalledWith(20);
    expect(qb.offset).toHaveBeenCalledWith(40);
  });
});
