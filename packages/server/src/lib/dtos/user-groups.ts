/**
 * 用户组相关 DTO
 */
import { z } from '@hono/zod-openapi';
import { auditFields } from './_audit';
import { UserPreviewDTO } from './_user-preview';

export const UserGroupMemberPreviewDTO = UserPreviewDTO;

export const UserGroupMemberRuleDTO = z
  .object({
    departmentIds: z.array(z.number().int()).optional(),
    includeSubDepartments: z.boolean().optional(),
    positionIds: z.array(z.number().int()).optional(),
    includeUserIds: z.array(z.number().int()).optional(),
    excludeUserIds: z.array(z.number().int()).optional(),
  })
  .openapi('UserGroupMemberRule');

export const UserGroupDTO = z
  .object({
    id: z.number().int(),
    name: z.string().openapi({ example: '研发部审批组' }),
    code: z.string().openapi({ example: 'rd_approver' }),
    description: z.string().nullable().optional(),
    ownerId: z.number().int().nullable().optional(),
    ownerName: z.string().nullable().optional(),
    memberMode: z.enum(['static', 'dynamic']).openapi({ description: '成员模式：static 手工维护 / dynamic 规则自动物化' }),
    memberRule: UserGroupMemberRuleDTO.nullable().optional(),
    ruleSyncedAt: z.string().nullable().optional().openapi({ description: '动态组最近成员同步时间' }),
    memberCount: z.number().int().openapi({ example: 5 }),
    memberPreview: z.array(UserGroupMemberPreviewDTO).optional(),
    roleCount: z.number().int().optional().openapi({ description: '绑定的角色数量' }),
    status: z.enum(['enabled', 'disabled']),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('UserGroup');

export const UserGroupRulePreviewDTO = z
  .object({
    total: z.number().int().openapi({ description: '规则命中的目标成员总数' }),
    joiningCount: z.number().int(),
    leavingCount: z.number().int(),
    joining: z.array(z.object({ id: z.number().int(), username: z.string(), nickname: z.string() })).openapi({ description: '将加入的用户（最多 50 条明细）' }),
    leaving: z.array(z.object({ id: z.number().int(), username: z.string(), nickname: z.string() })).openapi({ description: '将移除的用户（最多 50 条明细）' }),
  })
  .openapi('UserGroupRulePreview');

export const UserGroupMemberDTO = z
  .object({
    id: z.number().int(),
    username: z.string(),
    nickname: z.string(),
    email: z.string().nullable().optional(),
    departmentName: z.string().nullable().optional(),
    joinedAt: z.string(),
  })
  .openapi('UserGroupMember');

export const UserGroupRoleDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    status: z.enum(['enabled', 'disabled']),
  })
  .openapi('UserGroupRole');
