/**
 * API 路径契约测试的允许清单：web 已在调用、但服务端尚无对应端点的缺口。
 * 每一条都必须写明原因；缺口补上后测试会强制要求移除。
 */
export interface ApiConformanceException {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** 归一化路径：参数段写 `:p` */
  readonly path: string;
  readonly reason: string;
}

export const API_CONFORMANCE_ALLOWLIST: readonly ApiConformanceException[] = [
  {
    method: 'POST',
    path: '/api/member/files/avatar',
    reason: '会员前台头像上传（EditProfilePage / useUploadMemberAvatar）尚无服务端路由，需在 member 域补充契约与上传实现',
  },
];
