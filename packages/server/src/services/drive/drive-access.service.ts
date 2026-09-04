import { HTTPException } from 'hono/http-exception';
import { and, eq, gt, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import {
  DRIVE_SUBJECT_TYPES,
  driveRoleAtLeast,
  maxDriveRole,
  type DriveRole,
  type DriveSubjectType,
} from '@zenith/shared/drive';
import { db } from '../../db';
import {
  departments,
  driveNodePermissions,
  driveNodes,
  driveSpaceMembers,
  driveSpaces,
  roles,
  userGroupRoles,
  userGroups,
  userRoles,
  users,
  type DriveSpaceRow,
} from '../../db/schema';
import type { JwtPayload } from '../../middleware/auth';
import { currentUserOrNull, hasPermission, isSuperAdmin } from '../../lib/context';
import { getUserEnabledGroupIds } from '../../lib/user-group-access';

/**
 * 企业网盘访问控制核心。
 *
 * 有效角色 = 菜单 RBAC（路由层 guard 已校验）∧ max(空间角色, 节点 ACL)：
 * - 空间角色：personal 所有者 / department 部门（含子部门）成员与负责人 / team 显式成员或公开默认角色；
 * - 节点 ACL：沿 ancestorIds + 自身向下匹配四类主体的授权，遇 inheritPermissions=false 从该节点起算；
 * - 空间 manager 与网盘管理员（`drive:admin:space:edit`）不受继承断点影响。
 */

export interface DriveSubjectSet {
  userId: number;
  user: Set<number>;
  /** 本部门 + 全部上级部门（授权给部门即覆盖其子部门成员） */
  department: Set<number>;
  /** 直接角色 + 启用用户组继承的启用角色 */
  role: Set<number>;
  user_group: Set<number>;
  /** 用户直属部门 */
  departmentId: number | null;
  /** 平台超管或网盘管理员：全局 manager */
  isAdmin: boolean;
}

const EMPTY_SUBJECTS: DriveSubjectSet = {
  userId: 0, user: new Set(), department: new Set(), role: new Set(), user_group: new Set(), departmentId: null, isAdmin: false,
};

// 按请求主体对象 memo：同一请求内多次解析只查一次库
const subjectCache = new WeakMap<JwtPayload, Promise<DriveSubjectSet>>();

export async function loadDriveSubjects(): Promise<DriveSubjectSet> {
  const user = currentUserOrNull();
  if (!user) return EMPTY_SUBJECTS;
  let pending = subjectCache.get(user);
  if (!pending) {
    pending = buildSubjects(user);
    subjectCache.set(user, pending);
  }
  return pending;
}

async function buildSubjects(user: JwtPayload): Promise<DriveSubjectSet> {
  const [userRow, directRoles, groupIds, isAdmin] = await Promise.all([
    db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, user.userId)).limit(1),
    db.select({ roleId: userRoles.roleId }).from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, user.userId), eq(roles.status, 'enabled'))),
    getUserEnabledGroupIds(user.userId),
    isSuperAdmin() ? Promise.resolve(true) : hasPermission('drive:admin:space:edit'),
  ]);
  const groupRoles = groupIds.length
    ? await db.select({ roleId: userGroupRoles.roleId }).from(userGroupRoles)
      .innerJoin(roles, eq(roles.id, userGroupRoles.roleId))
      .innerJoin(userGroups, eq(userGroups.id, userGroupRoles.groupId))
      .where(and(inArray(userGroupRoles.groupId, groupIds), eq(roles.status, 'enabled'), eq(userGroups.status, 'enabled')))
    : [];
  const departmentId = userRow[0]?.departmentId ?? null;
  return {
    userId: user.userId,
    user: new Set([user.userId]),
    department: new Set(departmentId ? await loadDepartmentChain(departmentId) : []),
    role: new Set([...directRoles.map((r) => r.roleId), ...groupRoles.map((r) => r.roleId)]),
    user_group: new Set(groupIds),
    departmentId,
    isAdmin,
  };
}

/** 部门及其全部上级部门 id（自下而上） */
export async function loadDepartmentChain(departmentId: number): Promise<number[]> {
  const rows = await db.select({ id: departments.id, parentId: departments.parentId }).from(departments);
  const parents = new Map(rows.map((r) => [r.id, r.parentId]));
  const chain: number[] = [];
  const seen = new Set<number>();
  let cursor: number | undefined = departmentId;
  while (cursor && cursor > 0 && !seen.has(cursor) && parents.has(cursor)) {
    chain.push(cursor);
    seen.add(cursor);
    cursor = parents.get(cursor);
  }
  return chain;
}

/** 部门及其全部子部门 id（自上而下），供部门主体展开成员用 */
export async function loadDepartmentDescendants(departmentId: number): Promise<number[]> {
  const rows = await db.select({ id: departments.id, parentId: departments.parentId }).from(departments);
  const result = [departmentId];
  const queue = [departmentId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const r of rows) {
      if (r.parentId === cur && !result.includes(r.id)) {
        result.push(r.id);
        queue.push(r.id);
      }
    }
  }
  return result;
}

/** (subjectType, subjectId) ∈ 当前用户主体集合 的 SQL 条件；无主体时恒 false */
export function subjectPairsCondition(
  table: { subjectType: PgColumn; subjectId: PgColumn },
  subjects: DriveSubjectSet,
): SQL {
  const parts: SQL[] = [];
  for (const type of DRIVE_SUBJECT_TYPES) {
    const ids = [...subjects[type]];
    if (ids.length) parts.push(and(eq(table.subjectType, type), inArray(table.subjectId, ids))!);
  }
  return parts.length ? or(...parts)! : sql`false`;
}

function subjectMatches(entry: { subjectType: DriveSubjectType; subjectId: number }, subjects: DriveSubjectSet): boolean {
  return subjects[entry.subjectType].has(entry.subjectId);
}

// ─── 空间角色 ─────────────────────────────────────────────────────────────────

type SpaceLike = Pick<DriveSpaceRow, 'id' | 'type' | 'ownerId' | 'departmentId' | 'defaultMemberRole' | 'status'>;

interface SpaceContext {
  members: Array<{ spaceId: number; subjectType: DriveSubjectType; subjectId: number; role: DriveRole }>;
  leaderDeptIds: Set<number>;
}

async function loadSpaceContext(spaces: SpaceLike[], subjects: DriveSubjectSet): Promise<SpaceContext> {
  const spaceIds = spaces.map((s) => s.id);
  const deptIds = spaces.map((s) => s.departmentId).filter((id): id is number => id != null);
  const [members, leaderDepts] = await Promise.all([
    spaceIds.length
      ? db.select().from(driveSpaceMembers)
        .where(and(inArray(driveSpaceMembers.spaceId, spaceIds), subjectPairsCondition(driveSpaceMembers, subjects)))
      : Promise.resolve([]),
    deptIds.length
      ? db.select({ id: departments.id }).from(departments)
        .where(and(inArray(departments.id, deptIds), eq(departments.leaderId, subjects.userId)))
      : Promise.resolve([]),
  ]);
  return { members, leaderDeptIds: new Set(leaderDepts.map((d) => d.id)) };
}

function computeSpaceRole(space: SpaceLike, subjects: DriveSubjectSet, ctx: SpaceContext): DriveRole | null {
  if (subjects.isAdmin) return 'manager';
  if (space.status !== 'enabled') return null;
  let role: DriveRole | null = null;
  if (space.type === 'personal') {
    if (space.ownerId === subjects.userId) return 'manager';
  } else if (space.type === 'department') {
    if (space.departmentId && ctx.leaderDeptIds.has(space.departmentId)) return 'manager';
    if (space.departmentId && subjects.department.has(space.departmentId)) role = space.defaultMemberRole;
  } else {
    if (space.ownerId === subjects.userId) return 'manager';
    // 公开协作空间：defaultMemberRole 非空即全员可访问
    role = space.defaultMemberRole;
  }
  for (const m of ctx.members) {
    if (m.spaceId === space.id && subjectMatches(m, subjects)) role = maxDriveRole(role, m.role);
  }
  return role;
}

/** 批量解析当前用户在多个空间的角色 */
export async function resolveSpaceRoles(spaces: SpaceLike[]): Promise<Map<number, DriveRole | null>> {
  const subjects = await loadDriveSubjects();
  const ctx = await loadSpaceContext(spaces, subjects);
  return new Map(spaces.map((s) => [s.id, computeSpaceRole(s, subjects, ctx)]));
}

export async function resolveSpaceRole(space: SpaceLike): Promise<DriveRole | null> {
  return (await resolveSpaceRoles([space])).get(space.id) ?? null;
}

export async function ensureSpaceRole(space: SpaceLike, minRole: DriveRole): Promise<DriveRole> {
  const role = await resolveSpaceRole(space);
  if (!driveRoleAtLeast(role, minRole)) throw new HTTPException(403, { message: '没有该空间的操作权限' });
  return role!;
}

// ─── 节点角色 ─────────────────────────────────────────────────────────────────

export type NodeLike = { id: number; spaceId: number; ancestorIds: number[]; inheritPermissions: boolean };

export interface NodeRoleResolution {
  role: DriveRole | null;
  spaceRole: DriveRole | null;
  /** 命中的授权明细（含继承来源），供权限面板展示 */
  grants: Array<{ nodeId: number; subjectType: DriveSubjectType; subjectId: number; role: DriveRole }>;
}

/**
 * 批量解析当前用户对若干节点的有效角色（一次加载空间、祖先节点与命中的授权）。
 */
export async function resolveNodeRoles(nodes: NodeLike[]): Promise<Map<number, NodeRoleResolution>> {
  const result = new Map<number, NodeRoleResolution>();
  if (nodes.length === 0) return result;
  const subjects = await loadDriveSubjects();

  const spaceIds = [...new Set(nodes.map((n) => n.spaceId))];
  const chainIds = [...new Set(nodes.flatMap((n) => [...n.ancestorIds, n.id]))];
  const [spaces, chainNodes, grants] = await Promise.all([
    db.select({
      id: driveSpaces.id, type: driveSpaces.type, ownerId: driveSpaces.ownerId, departmentId: driveSpaces.departmentId,
      defaultMemberRole: driveSpaces.defaultMemberRole, status: driveSpaces.status,
    }).from(driveSpaces).where(inArray(driveSpaces.id, spaceIds)),
    db.select({ id: driveNodes.id, inheritPermissions: driveNodes.inheritPermissions }).from(driveNodes)
      .where(inArray(driveNodes.id, chainIds)),
    subjects.isAdmin
      ? Promise.resolve([])
      : db.select({
        nodeId: driveNodePermissions.nodeId, subjectType: driveNodePermissions.subjectType,
        subjectId: driveNodePermissions.subjectId, role: driveNodePermissions.role,
      }).from(driveNodePermissions).where(and(
        inArray(driveNodePermissions.nodeId, chainIds),
        subjectPairsCondition(driveNodePermissions, subjects),
        or(isNull(driveNodePermissions.expireAt), gt(driveNodePermissions.expireAt, new Date())),
      )),
  ]);
  const ctx = await loadSpaceContext(spaces, subjects);
  const spaceRoleMap = new Map(spaces.map((s) => [s.id, computeSpaceRole(s, subjects, ctx)]));
  const inheritMap = new Map(chainNodes.map((n) => [n.id, n.inheritPermissions]));
  const grantsByNode = new Map<number, typeof grants>();
  for (const g of grants) {
    const list = grantsByNode.get(g.nodeId) ?? [];
    list.push(g);
    grantsByNode.set(g.nodeId, list);
  }

  for (const node of nodes) {
    const spaceRole = spaceRoleMap.get(node.spaceId) ?? null;
    if (spaceRole === 'manager') {
      result.set(node.id, { role: 'manager', spaceRole, grants: [] });
      continue;
    }
    const chain = [...node.ancestorIds, node.id];
    let start = 0;
    chain.forEach((id, idx) => {
      const inherit = id === node.id ? node.inheritPermissions : inheritMap.get(id);
      if (inherit === false) start = idx;
    });
    const effectiveChain = chain.slice(start);
    const hitGrants = effectiveChain.flatMap((id) => grantsByNode.get(id) ?? []);
    const nodeRole = maxDriveRole(...hitGrants.map((g) => g.role));
    const role = start > 0 ? nodeRole : maxDriveRole(spaceRole, nodeRole);
    result.set(node.id, { role, spaceRole, grants: hitGrants });
  }
  return result;
}

export async function resolveNodeRole(node: NodeLike): Promise<DriveRole | null> {
  return (await resolveNodeRoles([node])).get(node.id)?.role ?? null;
}

export async function ensureNodeRole(node: NodeLike, minRole: DriveRole, message = '没有该文件的操作权限'): Promise<DriveRole> {
  const role = await resolveNodeRole(node);
  if (!driveRoleAtLeast(role, minRole)) throw new HTTPException(403, { message });
  return role!;
}

// ─── 跨空间可见性 SQL（列表粗过滤，页内再精确校验） ────────────────────────────

/** 当前用户可访问的空间 id 子查询 */
export function accessibleSpaceIdsSubquery(subjects: DriveSubjectSet) {
  const deptIds = [...subjects.department];
  const leaderSpaces = db.select({ id: departments.id }).from(departments).where(eq(departments.leaderId, subjects.userId));
  const memberSpaces = db.select({ id: driveSpaceMembers.spaceId }).from(driveSpaceMembers)
    .where(subjectPairsCondition(driveSpaceMembers, subjects));
  return db.select({ id: driveSpaces.id }).from(driveSpaces).where(and(
    eq(driveSpaces.status, 'enabled'),
    or(
      and(eq(driveSpaces.type, 'personal'), eq(driveSpaces.ownerId, subjects.userId)),
      and(eq(driveSpaces.type, 'department'), isNotNull(driveSpaces.defaultMemberRole), deptIds.length ? inArray(driveSpaces.departmentId, deptIds) : sql`false`),
      and(eq(driveSpaces.type, 'department'), inArray(driveSpaces.departmentId, leaderSpaces)),
      and(eq(driveSpaces.type, 'team'), or(eq(driveSpaces.ownerId, subjects.userId), isNotNull(driveSpaces.defaultMemberRole))),
      inArray(driveSpaces.id, memberSpaces),
    ),
  ));
}

/** 直接授权给当前用户主体的节点 id 子查询（未过期） */
export function grantedNodeIdsSubquery(subjects: DriveSubjectSet) {
  return db.select({ id: driveNodePermissions.nodeId }).from(driveNodePermissions).where(and(
    subjectPairsCondition(driveNodePermissions, subjects),
    or(isNull(driveNodePermissions.expireAt), gt(driveNodePermissions.expireAt, new Date())),
  ));
}

/**
 * 节点可见性粗过滤：所属空间可访问 ∪ 自身被授权 ∪ 祖先被授权。
 * 未考虑继承断点，调用方对结果页调用 resolveNodeRoles 精确校验。
 */
export function driveNodeAccessCondition(subjects: DriveSubjectSet): SQL | undefined {
  if (subjects.isAdmin) return undefined;
  const granted = grantedNodeIdsSubquery(subjects);
  return or(
    inArray(driveNodes.spaceId, accessibleSpaceIdsSubquery(subjects)),
    inArray(driveNodes.id, granted),
    sql`${driveNodes.ancestorIds} && ARRAY(${granted})`,
  );
}

/** 页级精确过滤：剔除无 viewer 权限的节点，并附带 myRole */
export async function filterVisibleNodes<T extends NodeLike>(rows: T[]): Promise<Array<T & { myRole: DriveRole | null }>> {
  const roleMap = await resolveNodeRoles(rows);
  return rows
    .map((row) => ({ ...row, myRole: roleMap.get(row.id)?.role ?? null }))
    .filter((row) => driveRoleAtLeast(row.myRole, 'viewer'));
}
