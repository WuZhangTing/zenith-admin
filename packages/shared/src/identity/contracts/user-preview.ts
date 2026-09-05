import * as z from 'zod';

/** 部门 / 角色 / 岗位 / 用户组列表「成员」列共用的成员摘要项 */
export const userPreviewSchema = z.object({
  id: z.int(),
  nickname: z.string(),
  avatar: z.string().nullable().optional(),
}).meta({ id: 'UserPreview' });

export type UserPreview = z.infer<typeof userPreviewSchema>;
