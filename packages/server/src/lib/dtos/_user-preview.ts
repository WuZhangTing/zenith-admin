import { z } from '@hono/zod-openapi';

/** 部门、角色、岗位和用户组列表共用的成员摘要项。 */
export const UserPreviewDTO = z.object({
  id: z.number().int(),
  nickname: z.string(),
  avatar: z.string().nullable().optional(),
});
