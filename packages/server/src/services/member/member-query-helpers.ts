import { eq, ilike, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../../db';
import { members } from '../../db/schema';
import { escapeLike } from '../../lib/where-helpers';

export interface MemberReferenceQuery {
  memberId?: number;
  memberKeyword?: string;
}

export function memberReferenceCondition(
  memberIdColumn: PgColumn,
  query: MemberReferenceQuery,
): SQL | undefined {
  if (query.memberId) return eq(memberIdColumn, query.memberId);
  if (!query.memberKeyword) return undefined;

  const numericMemberId = /^\d+$/.test(query.memberKeyword)
    ? parseInt(query.memberKeyword, 10)
    : null;
  if (numericMemberId) return eq(memberIdColumn, numericMemberId);

  return inArray(
    memberIdColumn,
    db
      .select({ id: members.id })
      .from(members)
      .where(ilike(members.nickname, `%${escapeLike(query.memberKeyword)}%`)),
  );
}
