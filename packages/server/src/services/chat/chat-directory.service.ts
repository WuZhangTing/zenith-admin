import { eq, and, or, ne, asc, sql } from 'drizzle-orm';
import { db } from '../../db';
import { departments, users } from '../../db/schema';
import { currentUser } from '../../lib/context';

// ─── 获取可聊天的用户列表 ──────────────────────────────────────────────────────

export async function listChatUsers(keyword?: string) {
  const me = currentUser();

  const rows = await db
    .select({ id: users.id, nickname: users.nickname, avatar: users.avatar, username: users.username })
    .from(users)
    .where(and(
      ne(users.id, me.userId),
      eq(users.status, 'enabled'),
      me.tenantId ? eq(users.tenantId, me.tenantId) : undefined,
      keyword
        ? or(
            sql`${users.nickname} ILIKE ${'%' + keyword + '%'}`,
            sql`${users.username} ILIKE ${'%' + keyword + '%'}`,
          )
        : undefined,
    ))
    .limit(50);

  return rows;
}

// ─── 组织架构选人数据 ─────────────────────────────────────────────────────────

export async function getChatOrgData() {
  const me = currentUser();

  const [deptRows, userRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name, parentId: departments.parentId })
      .from(departments)
      .where(and(
        eq(departments.status, 'enabled'),
        me.tenantId ? eq(departments.tenantId, me.tenantId) : undefined,
      ))
      .orderBy(asc(departments.sort), asc(departments.id)),
    db
      .select({
        id: users.id, nickname: users.nickname, username: users.username,
        avatar: users.avatar, departmentId: users.departmentId,
      })
      .from(users)
      .where(and(
        ne(users.id, me.userId),
        eq(users.status, 'enabled'),
        me.tenantId ? eq(users.tenantId, me.tenantId) : undefined,
      ))
      .orderBy(asc(users.id)),
  ]);

  return { departments: deptRows, users: userRows };
}
