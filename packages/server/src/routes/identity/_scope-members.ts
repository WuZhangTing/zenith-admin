/**
 * 「成员预览」路由工厂：部门 / 角色 / 岗位 / 用户组四处形状完全一致，只有 tag 与权限码不同。
 *
 * 之所以做成四条各自守卫的路由、而不是一条带 scopeType 参数的通用路由：
 * `guard({ permission: [...] })` 是「满足其一」语义，通用路由只能声明四个权限的并集，
 * 那样只有角色查看权的人就能读到部门成员。每个域用自己的 `:list` 权限守卫，
 * 才能保证「能看见这个列表页 = 能看这一列的成员」，前端也因此不需要任何额外权限判断。
 */
import { createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { IdParam, PaginationQuery, commonErrorResponses, okBody, okPaginated } from '../../lib/openapi-schemas';
import { ScopeMemberDTO } from '../../lib/openapi-dtos';
import { listScopeMembers, type UserScopeType } from '../../services/identity/user-scope.service';

export function defineScopeMembersRoute(options: {
  scopeType: UserScopeType;
  tag: string;
  permission: string;
  summary: string;
}) {
  return defineOpenAPIRoute({
    route: createRoute({
      method: 'get',
      path: '/{id}/member-preview',
      tags: [options.tag],
      summary: options.summary,
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: options.permission })] as const,
      request: {
        params: IdParam,
        query: PaginationQuery.extend({ keyword: z.string().max(64).optional() }),
      },
      responses: { ...okPaginated(ScopeMemberDTO, '成员列表'), ...commonErrorResponses },
    }),
    handler: async (c) => c.json(
      okBody(await listScopeMembers(options.scopeType, c.req.valid('param').id, c.req.valid('query'))),
      200,
    ),
  });
}
