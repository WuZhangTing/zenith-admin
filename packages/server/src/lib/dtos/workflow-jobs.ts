import { z } from '@hono/zod-openapi';
import { WorkflowDiagnosticBundleDTO } from './workflow-events';

const WORKFLOW_JOB_TYPES = [
  'delay_wake', 'task_timeout', 'trigger_dispatch', 'external_dispatch',
  'subprocess_spawn', 'subprocess_join', 'event_dispatch', 'webhook_delivery',
  'compensation_action',
] as const;

const WORKFLOW_JOB_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'dead', 'canceled'] as const;

export const WorkflowJobDTO = z
  .object({
    id: z.number().int(),
    jobType: z.enum(WORKFLOW_JOB_TYPES),
    status: z.enum(WORKFLOW_JOB_STATUSES),
    instanceId: z.number().int().nullable(),
    instanceTitle: z.string().nullable(),
    definitionName: z.string().nullable(),
    taskId: z.number().int().nullable(),
    nodeKey: z.string().nullable(),
    idempotencyKey: z.string().nullable(),
    traceId: z.string().nullable(),
    payload: z.record(z.string(), z.unknown()),
    priority: z.number().int(),
    attempts: z.number().int(),
    maxAttempts: z.number().int(),
    runAt: z.string(),
    lockedAt: z.string().nullable(),
    lockedBy: z.string().nullable(),
    lastError: z.string().nullable(),
    result: z.record(z.string(), z.unknown()).nullable(),
    tenantId: z.number().int().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WorkflowJob');

export const WorkflowJobExecutionDTO = z
  .object({
    id: z.number().int(),
    jobId: z.number().int(),
    jobType: z.enum(WORKFLOW_JOB_TYPES),
    attempt: z.number().int(),
    status: z.enum(['running', 'succeeded', 'failed']),
    requestUrl: z.string().nullable(),
    requestMethod: z.string().nullable(),
    requestBody: z.string().nullable(),
    responseStatus: z.number().int().nullable(),
    responseBody: z.string().nullable(),
    errorMessage: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('WorkflowJobExecution');

export const WorkflowJobDetailDTO = WorkflowJobDTO.extend({
  executions: z.array(WorkflowJobExecutionDTO),
}).openapi('WorkflowJobDetail');

/** 链路视图：同一 traceId 关联的全部作业 + 执行明细 + 状态统计 */
export const WorkflowJobChainDTO = z.object({
  traceId: z.string(),
  jobs: z.array(WorkflowJobDetailDTO),
  stats: z.object({
    total: z.number().int(),
    pending: z.number().int(),
    running: z.number().int(),
    succeeded: z.number().int(),
    failed: z.number().int(),
    dead: z.number().int(),
    canceled: z.number().int(),
    instanceIds: z.array(z.number().int()),
  }),
}).openapi('WorkflowJobChain');

/** 列表查询 query（叠加 PaginationQuery） */
export const WorkflowJobListQuery = z.object({
  jobType: z.enum(WORKFLOW_JOB_TYPES).optional(),
  status: z.enum(WORKFLOW_JOB_STATUSES).optional(),
  instanceId: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional(),
});

/** traceId 诊断包：作业链路 + 该 traceId 涉及的各实例诊断包（跨实例/子流程聚合，供工单留档/离线分析） */
export const WorkflowTraceDiagnosticBundleDTO = z.object({
  traceId: z.string(),
  generatedAt: z.string(),
  chain: WorkflowJobChainDTO,
  instances: z.array(WorkflowDiagnosticBundleDTO),
}).openapi('WorkflowTraceDiagnosticBundle');

/** 重试 / 改参重放 body */
export const WorkflowJobRetryBody = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** 按作业类型聚合的状态计数（作业账本 Tab 徽标用） */
export const WorkflowJobSummaryItemDTO = z
  .object({
    jobType: z.enum(WORKFLOW_JOB_TYPES),
    total: z.number().int(),
    pending: z.number().int(),
    running: z.number().int(),
    succeeded: z.number().int(),
    failed: z.number().int(),
    dead: z.number().int(),
    canceled: z.number().int(),
  })
  .openapi('WorkflowJobSummaryItem');

/** 批量补偿结果 */
export const WorkflowJobBatchResultDTO = z
  .object({
    total: z.number().int(),
    success: z.number().int(),
    skipped: z.number().int(),
  })
  .openapi('WorkflowJobBatchResult');

/** 死信条件重放过滤条件（多维：类型/实例/traceId/错误原因/入库时长） */
export const WorkflowJobReplayFilterBody = z.object({
  status: z.enum(['dead', 'failed']).optional(),
  jobType: z.enum(WORKFLOW_JOB_TYPES).optional(),
  instanceId: z.number().int().positive().optional(),
  traceId: z.string().trim().min(1).max(128).optional(),
  reasonKeyword: z.string().trim().min(1).max(200).optional(),
  olderThanMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
});

/** 死信重放 body：过滤条件 + 限流（ratePerSecond 条/秒错峰）+ 单次上限 limit */
export const WorkflowJobReplayBody = WorkflowJobReplayFilterBody.extend({
  ratePerSecond: z.number().int().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/** 条件重放预览结果 */
export const WorkflowJobReplayPreviewDTO = z
  .object({ matched: z.number().int() })
  .openapi('WorkflowJobReplayPreview');

/** 死信重放结果（含匹配总数与实际生效限流） */
export const WorkflowJobReplayResultDTO = z
  .object({
    total: z.number().int(),
    success: z.number().int(),
    skipped: z.number().int(),
    matched: z.number().int(),
    ratePerSecond: z.number().int(),
    limit: z.number().int(),
  })
  .openapi('WorkflowJobReplayResult');

/** 批量重试 body：选中的作业 id + 可选限流速率 */
export const WorkflowJobBatchRetryBody = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  ratePerSecond: z.number().int().min(1).max(200).optional(),
});

/** 失败聚类维度 query */
export const WorkflowJobFailureClusterQuery = z.object({
  dimension: z.enum(['reason', 'jobType', 'instance', 'trace']).optional(),
});

/** 失败聚类项（多维，支持对某簇直接重放；附成员作业明细回答"哪个作业/进程/时间/原因"） */
export const WorkflowJobFailureClusterDTO = z
  .object({
    dimension: z.enum(['reason', 'jobType', 'instance', 'trace']),
    key: z.string(),
    label: z.string(),
    count: z.number().int(),
    jobTypes: z.array(z.string()),
    instanceId: z.number().int().nullable(),
    traceId: z.string().nullable(),
    reasonKeyword: z.string().nullable(),
    /** 簇内最早失败时间 */
    firstAt: z.string().nullable(),
    /** 簇内最近失败时间 */
    lastAt: z.string().nullable(),
    /** 涉及的流程实例数 */
    instanceCount: z.number().int(),
    /** 成员作业明细（按最近失败倒序，最多 10 条） */
    jobs: z.array(z.object({
      id: z.number().int(),
      jobType: z.string(),
      status: z.string(),
      instanceId: z.number().int().nullable(),
      instanceTitle: z.string().nullable(),
      definitionName: z.string().nullable(),
      nodeKey: z.string().nullable(),
      attempts: z.number().int(),
      maxAttempts: z.number().int(),
      /** 最后领取该作业的 worker 节点（hostname:pid） */
      lockedBy: z.string().nullable(),
      traceId: z.string().nullable(),
      /** 完整原始错误 */
      lastError: z.string().nullable(),
      /** 最近失败时间 */
      failedAt: z.string(),
      createdAt: z.string(),
    })),
  })
  .openapi('WorkflowJobFailureCluster');

/** 作业平台运行状态（worker 心跳聚合 + 作业维度派生指标） */
export const WorkflowJobRuntimeStatusDTO = z
  .object({
    /** 存活 worker（心跳新鲜的调度节点）数 */
    activeWorkers: z.number().int(),
    /** 已注册节点总数 */
    totalWorkers: z.number().int(),
    /** 各存活节点明细 */
    workers: z.array(z.object({
      nodeId: z.string(),
      hostname: z.string().nullable(),
      runningJobCount: z.number().int(),
      lastHeartbeatAt: z.string().nullable(),
      fresh: z.boolean(),
    })),
    /** 在途（running）作业数 */
    runningJobs: z.number().int(),
    /** 卡死（running 且锁定超过宽限期）作业数 */
    stuckRunningJobs: z.number().int(),
    /** 到期待处理（pending 且 runAt<=now）作业数 = 积压 */
    backlog: z.number().int(),
    /** 死信作业数 */
    deadLetter: z.number().int(),
    /** 最后领取时间（max lockedAt） */
    lastClaimedAt: z.string().nullable(),
    /** 近 60 分钟执行失败率（%） */
    failureRate: z.number(),
    /** 近 60 分钟平均处理耗时（ms） */
    avgDurationMs: z.number().int().nullable(),
    /** 近 60 分钟执行总数 */
    recentExecutions: z.number().int(),
  })
  .openapi('WorkflowJobRuntimeStatus');
