/**
 * Demo 模式：成员预览（部门 / 角色 / 岗位 / 用户组的分页成员名单）。
 *
 * 四条真实接口形状一致，故 mock 也共用一份实现，避免四处各写一遍后口径漂移。
 */
import { http } from 'msw';
import { mockUsers } from '../data/users';
import { mockUserGroups } from '../data/user-groups';
import { ok, paginate } from '../utils/handlers';

type ScopePath = 'departments' | 'roles' | 'positions' | 'user-groups';

/** 各范围的成员判定，与服务端 user-scope.service 的归属条件一一对应 */
const MEMBER_OF: Record<ScopePath, (user: (typeof mockUsers)[number], scopeId: number) => boolean> = {
  departments: (u, id) => u.departmentId === id,
  roles: (u, id) => (u.roles ?? []).some((r) => r.id === id),
  positions: (u, id) => (u.positionIds ?? []).includes(id),
  'user-groups': (u, id) => (mockUserGroups.find((g) => g.id === id)?.memberIds ?? []).includes(u.id),
};

function memberPreviewHandler(scope: ScopePath) {
  return http.get(`/api/${scope}/:id/member-preview`, ({ params, request }) => {
    const scopeId = Number(params.id);
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();

    const list = mockUsers
      .filter((u) => MEMBER_OF[scope](u, scopeId))
      .filter((u) => !keyword || u.nickname.toLowerCase().includes(keyword) || u.username.toLowerCase().includes(keyword))
      .map((u) => ({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar ?? null }));

    return ok(paginate(list, url));
  });
}

export const scopeMembersHandlers = [
  memberPreviewHandler('departments'),
  memberPreviewHandler('roles'),
  memberPreviewHandler('positions'),
  memberPreviewHandler('user-groups'),
];
