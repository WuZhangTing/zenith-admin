import * as z from 'zod';
import { auditFieldsSchema } from '../../core/api-schemas';
import { ANALYTICS_EVENT_OVERRIDE_STATUSES, ANALYTICS_IDENTITY_TYPES } from '../constants';
import { analyticsSegmentRuleSchema } from '../validation';

// ─── 用户分群 ─────────────────────────────────────────────────────────────────

export const analyticsUserSegmentSchema = z.object({
  id: z.int(),
  tenantId: z.int().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  rules: analyticsSegmentRuleSchema,
  status: z.enum(ANALYTICS_EVENT_OVERRIDE_STATUSES),
  estimatedSize: z.int().meta({ description: '最近一次物化的成员数' }),
  snapshotAt: z.string().nullable().meta({ description: '最近一次物化时间；未物化为 null' }),
  ...auditFieldsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'AnalyticsUserSegment' });

export type AnalyticsUserSegment = z.infer<typeof analyticsUserSegmentSchema>;

/** 分群成员物化快照（异步任务重算） */
export const analyticsSegmentMemberSchema = z.object({
  id: z.int(),
  segmentId: z.int(),
  tenantId: z.int().nullable(),
  distinctId: z.string(),
  identityType: z.enum(ANALYTICS_IDENTITY_TYPES),
  userId: z.int().nullable(),
  memberId: z.int().nullable(),
  snapshotAt: z.string(),
}).meta({ id: 'AnalyticsSegmentMember' });

export type AnalyticsSegmentMember = z.infer<typeof analyticsSegmentMemberSchema>;
