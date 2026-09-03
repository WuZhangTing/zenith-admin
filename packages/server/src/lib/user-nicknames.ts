import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { keywordCondition } from './where-helpers';

/**
 * 批量解析用户名 → 昵称映射（日志/统计等只存 username 的场景补充展示名）。
 * 已删除或系统内不存在的用户名不在返回结果中；昵称与用户名相同也原样返回，
 * 是否降级展示由前端决定。
 */
export async function getNicknameMap(usernames: Array<string | null | undefined>): Promise<Map<string, string>> {
  const names = [...new Set(usernames.filter((n): n is string => !!n))];
  if (names.length === 0) return new Map();
  const rows = await db
    .select({ username: users.username, nickname: users.nickname })
    .from(users)
    .where(inArray(users.username, names));
  return new Map(rows.map((r) => [r.username, r.nickname]));
}

/**
 * 昵称关键字 → 用户名列表：日志表只存 username，支持按昵称搜索时先反查用户名。
 * 结果集有界（limit 200），供 IN 条件使用。
 */
export async function findUsernamesByNickname(keyword: string): Promise<string[]> {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(keywordCondition(keyword, [users.nickname]))
    .limit(200);
  return rows.map((r) => r.username);
}
