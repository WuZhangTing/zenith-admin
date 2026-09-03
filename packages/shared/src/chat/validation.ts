import * as z from 'zod';
import { httpUrl, linkUrl, partialForUpdate } from '../core/validation';

// ─── 聊天 ─────────────────────────────────────────────────────────────────────
export const chatLinkPreviewSchema = z.strictObject({
  url: httpUrl(),
  title: z.string().min(1).max(512),
  description: z.string().max(4000).nullable(),
  siteName: z.string().max(255).nullable(),
  image: httpUrl().nullable(),
  favicon: httpUrl().nullable(),
});

export const chatAssetMetaSchema = z.strictObject({
  kind: z.enum(['image', 'file', 'voice', 'video']),
  name: z.string().min(1).max(512),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(255).nullable(),
  extension: z.string().max(50).nullable(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  thumbnailUrl: linkUrl().max(2048).nullable().optional(),
  duration: z.number().nonnegative().nullable().optional(),
});

export const chatMentionSchema = z.strictObject({
  userId: z.number().int().positive(),
  nickname: z.string().min(1).max(100),
});

export const chatAnnouncementHistorySchema = z.strictObject({
  announcement: z.string().max(500).nullable(),
  operatorName: z.string().max(100).nullable(),
});

export const CHAT_MEDIA_MESSAGE_TYPES = ['image', 'file', 'voice', 'video'] as const;

/** 媒体类消息的 content 是被渲染为 src / href 的资源地址：仅接受托管文件路径或 http(s) URL */
export function isChatMediaContentSafe(type: string, content: string): boolean {
  if (!(CHAT_MEDIA_MESSAGE_TYPES as readonly string[]).includes(type)) return true;
  return linkUrl().safeParse(content).success;
}

export const chatForwardedItemSchema = z.object({
  senderName: z.string().max(100).nullable(),
  type: z.enum(['text', 'image', 'file', 'system', 'forward', 'vote', 'voice', 'card', 'video']),
  content: z.string().max(4096),
  createdAt: z.string(),
  asset: chatAssetMetaSchema.nullable().optional(),
}).refine((item) => isChatMediaContentSafe(item.type, item.content), {
  path: ['content'],
  message: '媒体消息地址仅支持 http(s) URL 或站内路径',
});

export const chatCardFieldSchema = z.object({
  label: z.string().max(60),
  value: z.string().max(500),
});

export const chatCardActionSchema = z.object({
  key: z.string().max(40),
  label: z.string().max(40),
  theme: z.enum(['primary', 'secondary', 'danger', 'tertiary']).optional(),
  action: z.enum(['workflow:approve', 'workflow:reject', 'link', 'none']),
  taskId: z.number().int().positive().nullable().optional(),
  url: linkUrl().max(1024).nullable().optional(),
  requireComment: z.boolean().optional(),
});

export const chatCardSchema = z.object({
  title: z.string().min(1).max(120),
  text: z.string().max(2000).nullable().optional(),
  fields: z.array(chatCardFieldSchema).max(20).nullable().optional(),
  actions: z.array(chatCardActionSchema).max(6).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
  status: z.enum(['pending', 'done']).nullable().optional(),
  statusText: z.string().max(60).nullable().optional(),
  instanceId: z.number().int().positive().nullable().optional(),
});

export const chatBotMetaSchema = z.object({
  name: z.string().min(1).max(64),
  avatar: z.string().max(256).nullable().optional(),
});

export const chatVoteOptionSchema = z.object({
  id: z.string().max(36),
  label: z.string().min(1).max(200),
});

export const chatVoteRecordSchema = z.object({
  userId: z.number().int(),
  optionIds: z.array(z.string().max(36)),
  nickname: z.string().max(100),
});

export const chatVoteDataSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(chatVoteOptionSchema).min(2).max(10),
  isMultiple: z.boolean(),
  isAnonymous: z.boolean(),
  expireAt: z.string().nullable(),
  votes: z.array(chatVoteRecordSchema),
  isClosed: z.boolean(),
});

export const chatMessageExtraSchema = z.strictObject({
  asset: chatAssetMetaSchema.nullable().optional(),
  linkPreview: chatLinkPreviewSchema.nullable().optional(),
  mentions: z.array(chatMentionSchema).max(20).nullable().optional(),
  isFavorited: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  announcementHistory: chatAnnouncementHistorySchema.nullable().optional(),
  forwardedMessages: z.array(chatForwardedItemSchema).max(100).nullable().optional(),
  forwardSourceConvName: z.string().max(100).nullable().optional(),
  hiddenFor: z.array(z.number().int()).nullable().optional(),
  voteData: chatVoteDataSchema.nullable().optional(),
  card: chatCardSchema.nullable().optional(),
  bot: chatBotMetaSchema.nullable().optional(),
});

export const editChatMessageSchema = z.object({
  content: z.string().min(1, '消息不能为空').max(4096),
});

export type EditChatMessageInput = z.infer<typeof editChatMessageSchema>;

export const forwardMessagesSchema = z.object({
  messageIds: z.array(z.number().int().positive()).min(1).max(100),
  targetConversationIds: z.array(z.number().int().positive()).min(1).max(20),
  mode: z.enum(['merge', 'individual']),
});

export type ForwardMessagesInput = z.infer<typeof forwardMessagesSchema>;

// ── 聊天入站 Webhook 机器人 ──
export const createChatWebhookSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  avatar: z.string().max(256).nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  conversationId: z.number().int().positive('请选择目标会话'),
  enabled: z.boolean().default(true),
});

export const updateChatWebhookSchema = partialForUpdate(createChatWebhookSchema).omit({ conversationId: true });

export type CreateChatWebhookInput = z.infer<typeof createChatWebhookSchema>;

export type UpdateChatWebhookInput = z.infer<typeof updateChatWebhookSchema>;

/** 入站 Webhook 推送 body：文本或卡片 */
export const chatWebhookPayloadSchema = z.object({
  type: z.enum(['text', 'card']).default('text'),
  text: z.string().max(4096).optional(),
  card: chatCardSchema.optional(),
}).refine((v) => (v.type === 'card' ? !!v.card : !!v.text), {
  message: 'text 或 card 至少提供一个',
});

export type ChatWebhookPayloadInput = z.infer<typeof chatWebhookPayloadSchema>;

// ── 通话记录（结束后写入会话系统消息）──
export const chatCallRecordSchema = z.object({
  callType: z.enum(['audio', 'video']),
  mode: z.enum(['p2p', 'group']),
  status: z.enum(['completed', 'missed', 'canceled', 'rejected']),
  /** 通话时长（秒），completed 时有效 */
  durationSec: z.number().int().nonnegative().default(0),
});

export type ChatCallRecordInput = z.infer<typeof chatCallRecordSchema>;
