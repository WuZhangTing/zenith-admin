import * as z from 'zod';
import { CHAT_MESSAGE_TYPES, CHAT_SCHEDULED_STATUSES } from '../constants';
import { chatMessageExtraSchema } from './chat-messages';

/** 定时消息 */
export const chatScheduledMessageSchema = z.object({
  id: z.int(),
  conversationId: z.int(),
  conversationName: z.string().nullable().meta({ description: '目标会话展示名（群名或对方昵称）' }),
  type: z.enum(CHAT_MESSAGE_TYPES),
  content: z.string(),
  extra: chatMessageExtraSchema.nullable(),
  scheduledAt: z.string(),
  status: z.enum(CHAT_SCHEDULED_STATUSES),
  failReason: z.string().nullable(),
  sentMessageId: z.int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'ChatScheduledMessage' });

export type ChatScheduledMessage = z.infer<typeof chatScheduledMessageSchema>;
