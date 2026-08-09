import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';

export interface WorkflowUserDisplay {
  name: string;
  avatar: string | null;
}

export async function loadWorkflowUserDisplays(
  ids: readonly number[],
): Promise<Map<number, WorkflowUserDisplay>> {
  const displays = new Map<number, WorkflowUserDisplay>();
  const uniqueIds = [...new Set(ids)].filter((id) => id > 0);
  if (uniqueIds.length === 0) return displays;

  const rows = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(inArray(users.id, uniqueIds));
  for (const row of rows) {
    displays.set(row.id, {
      name: row.nickname ?? row.username,
      avatar: row.avatar ?? null,
    });
  }
  return displays;
}
