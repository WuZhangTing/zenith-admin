import * as z from 'zod';

/** 个人快捷回复（常用语） */
export const chatQuickReplySchema = z.object({
  id: z.int(),
  content: z.string(),
  sort: z.int(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'ChatQuickReply' });

export type ChatQuickReply = z.infer<typeof chatQuickReplySchema>;
