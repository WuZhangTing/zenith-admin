import * as z from 'zod';
import { defineContract, op } from '../../core/contract';
import { WIKI_SPACE_VISIBILITIES } from '../constants';
import { updateWikiSettingsSchema } from '../validation';

// ─── 实体 ────────────────────────────────────────────────────────────────────

/** 知识库全局设置（存 system_configs，wiki 分组） */
export const wikiSettingsSchema = z.object({
  requireApproval: z.boolean().meta({ description: '发布是否需要审核（false 时提交即发布）' }),
  defaultVisibility: z.enum(WIKI_SPACE_VISIBILITIES).meta({ description: '新建空间的默认可见性' }),
  aiSyncEnabled: z.boolean().meta({ description: '是否启用发布文档同步 AI 知识库' }),
  aiSyncKbId: z.int().nullable().meta({ description: '同步目标 AI 知识库 ID' }),
  commentsEnabled: z.boolean().meta({ description: '是否允许评论' }),
  recycleRetentionDays: z.int().meta({ description: '回收站保留天数；0 = 永久保留' }),
  pendingRemindHours: z.int().meta({ description: '审核积压提醒时限（小时）' }),
}).meta({ id: 'WikiSettings' });

export type WikiSettings = z.infer<typeof wikiSettingsSchema>;

// ─── 契约 ────────────────────────────────────────────────────────────────────

export const wikiSettingsContract = defineContract('/api/wiki/settings', {
  get: op.get('/', { response: wikiSettingsSchema, summary: '获取知识库设置' }),
  update: op.put('/', { body: updateWikiSettingsSchema, response: wikiSettingsSchema, summary: '更新知识库设置' }),
}, { tags: ['知识中心-设置'] });
