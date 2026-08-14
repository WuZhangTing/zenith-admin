import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { wikiDocs, wikiSpaceMembers, wikiSpaces } from '../../db/schema';
import { currentUserId, isSuperAdmin } from '../../lib/context';

/**
 * 知识中心统一访问边界（P2-A）。
 *
 * 所有面向用户的文档读取口（列表 / 搜索 / 收藏 / 回收站 / 统计榜单）必须叠加本文件的条件，
 * 防止私有空间的标题、摘要、标签等元数据被非成员枚举。
 * 目录树与详情已有 getMySpaceRole 逐条校验，两者语义保持一致。
 */

/** 当前用户可访问的空间：启用的公开空间 ∪ 我是成员的空间；超管不限制 */
export function wikiSpaceAccessCondition(): SQL | undefined {
  if (isSuperAdmin()) return undefined;
  const uid = currentUserId();
  const publicSpaceIds = db.select({ id: wikiSpaces.id }).from(wikiSpaces)
    .where(and(eq(wikiSpaces.visibility, 'public'), eq(wikiSpaces.status, 'enabled')));
  const memberSpaceIds = db.select({ id: wikiSpaceMembers.spaceId }).from(wikiSpaceMembers)
    .where(eq(wikiSpaceMembers.userId, uid));
  return or(
    inArray(wikiDocs.spaceId, publicSpaceIds),
    inArray(wikiDocs.spaceId, memberSpaceIds),
  );
}

/** 我担任 editor 及以上角色的空间 ID 子查询 */
function editorSpaceIdsSubquery(uid: number) {
  return db.select({ id: wikiSpaceMembers.spaceId }).from(wikiSpaceMembers)
    .where(and(
      eq(wikiSpaceMembers.userId, uid),
      inArray(wikiSpaceMembers.role, ['owner', 'admin', 'editor']),
    ));
}

/**
 * 未发布内容可见性：已发布对空间可见者开放；草稿 / 待审 / 已驳回仅作者与 editor+ 可见。
 * 与 getWikiDoc 的详情校验同一规则。
 */
export function wikiDocStatusVisibilityCondition(): SQL | undefined {
  if (isSuperAdmin()) return undefined;
  const uid = currentUserId();
  return or(
    eq(wikiDocs.status, 'published'),
    eq(wikiDocs.createdBy, uid),
    inArray(wikiDocs.spaceId, editorSpaceIdsSubquery(uid)),
  );
}

/** 回收站可见性：已删除文档仅作者与 editor+ 可见（不存在「已发布的已删除文档」语义） */
export function wikiDeletedDocVisibilityCondition(): SQL | undefined {
  if (isSuperAdmin()) return undefined;
  const uid = currentUserId();
  return or(
    eq(wikiDocs.createdBy, uid),
    inArray(wikiDocs.spaceId, editorSpaceIdsSubquery(uid)),
  );
}
