import { describe, expect, it } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { memberWalletTransactions } from '../../db/schema';
import { memberReferenceCondition } from './member-query-helpers';

describe('memberReferenceCondition', () => {
  const dialect = new PgDialect();
  const toQuery = (condition: SQL | undefined) => dialect.sqlToQuery(condition!);

  it('returns no condition without a member filter', () => {
    expect(memberReferenceCondition(memberWalletTransactions.memberId, {})).toBeUndefined();
  });

  it('prefers an explicit member id over a keyword', () => {
    const query = toQuery(memberReferenceCondition(
      memberWalletTransactions.memberId,
      { memberId: 42, memberKeyword: 'ignored' },
    ));

    expect(query.sql).not.toContain('ilike');
    expect(query.params).toEqual([42]);
  });

  it('treats a numeric keyword as a member id', () => {
    const query = toQuery(memberReferenceCondition(
      memberWalletTransactions.memberId,
      { memberKeyword: '42' },
    ));

    expect(query.sql).not.toContain('ilike');
    expect(query.params).toEqual([42]);
  });

  it('searches nicknames and escapes LIKE metacharacters', () => {
    const query = toQuery(memberReferenceCondition(
      memberWalletTransactions.memberId,
      { memberKeyword: 'name%_' },
    ));

    expect(query.sql).toContain(' in ');
    expect(query.sql).toContain(' ilike ');
    expect(query.params).toEqual([String.raw`%name\%\_%`]);
  });
});
