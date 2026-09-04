import * as z from 'zod';

/** 自定义表情（个人收藏贴图） */
export const chatCustomEmojiSchema = z.object({
  id: z.int(),
  url: z.string(),
  fileId: z.string().nullable(),
  name: z.string().nullable(),
  width: z.int().nullable(),
  height: z.int().nullable(),
  createdAt: z.string(),
}).meta({ id: 'ChatCustomEmoji' });

export type ChatCustomEmoji = z.infer<typeof chatCustomEmojiSchema>;
