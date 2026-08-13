import { createLabelOptions } from '../core/enum-options';

export const FILE_STORAGE_PROVIDERS = ['local', 'oss', 's3', 'cos', 'obs', 'kodo', 'bos', 'azure', 'sftp'] as const;

export const FILE_OBJECT_ACLS = ['default', 'private', 'public-read', 'public-read-write'] as const;

/**
 * 各 provider 支持的对象级读写权限（canned ACL）；default = 继承 Bucket（上传时不发送 ACL 参数）。
 * COS 对象级 ACL 无 public-read-write；BOS 对象级 ACL 仅 private / public-read。
 * 未列出的 provider（local/kodo/azure/sftp）不支持对象级 ACL。
 */
export const FILE_OBJECT_ACL_SUPPORT: Partial<Record<(typeof FILE_STORAGE_PROVIDERS)[number], readonly (typeof FILE_OBJECT_ACLS)[number][]>> = {
  oss: ['default', 'private', 'public-read', 'public-read-write'],
  s3: ['default', 'private', 'public-read', 'public-read-write'],
  cos: ['default', 'private', 'public-read'],
  obs: ['default', 'private', 'public-read', 'public-read-write'],
  bos: ['default', 'private', 'public-read'],
};

/** 文件访问 URL 策略：proxy=服务端代理（兜底）；public=永久公开直链；presigned=临时签名直链 */
export const FILE_URL_STRATEGIES = ['proxy', 'public', 'presigned'] as const;

export const FILE_URL_STRATEGY_LABELS: Record<(typeof FILE_URL_STRATEGIES)[number], string> = {
  proxy: '服务端代理',
  public: '公开直链',
  presigned: '临时签名直链',
};

export const FILE_URL_STRATEGY_OPTIONS: Array<{ value: (typeof FILE_URL_STRATEGIES)[number]; label: string }> =
  createLabelOptions(FILE_URL_STRATEGIES, FILE_URL_STRATEGY_LABELS);

/** 临时签名有效期（秒）：默认 30 分钟，限制在 1 分钟 ~ 7 天（S3 SigV4 上限） */
export const PRESIGNED_EXPIRY_DEFAULT_SECONDS = 1800;

export const PRESIGNED_EXPIRY_MIN_SECONDS = 60;

export const PRESIGNED_EXPIRY_MAX_SECONDS = 604_800;

/** 存储提供方展示名（配置页/文件管理/统计面板统一复用） */
export const FILE_STORAGE_PROVIDER_LABELS: Record<(typeof FILE_STORAGE_PROVIDERS)[number], string> = {
  local: '本地磁盘',
  oss: '阿里云 OSS',
  s3: 'S3 兼容存储',
  cos: '腾讯云 COS',
  obs: '华为云 OBS',
  kodo: '七牛云 Kodo',
  bos: '百度云 BOS',
  azure: 'Azure Blob',
  sftp: 'SFTP',
};

/** 存储提供方下拉选项（与 FILE_STORAGE_PROVIDER_LABELS 自动同步） */
export const FILE_STORAGE_PROVIDER_OPTIONS: Array<{ value: (typeof FILE_STORAGE_PROVIDERS)[number]; label: string }> =
  createLabelOptions(FILE_STORAGE_PROVIDERS, FILE_STORAGE_PROVIDER_LABELS);

export const CONFIG_TYPES = ['string', 'number', 'boolean', 'json'] as const;

export const CRON_JOB_STATUSES = ['enabled', 'disabled'] as const;

export const CRON_RUN_STATUSES = ['success', 'fail', 'running'] as const;

/** 定时任务执行状态标签（列表页/仪表盘统一复用） */
export const CRON_RUN_STATUS_LABELS: Record<(typeof CRON_RUN_STATUSES)[number], string> = {
  success: '成功',
  fail: '失败',
  running: '运行中',
};

export const BACKUP_TYPES = ['pg_dump', 'drizzle_export'] as const;

export const BACKUP_STATUSES = ['pending', 'running', 'success', 'failed'] as const;

/** 内置「Zenith 助手」系统号 code（全局唯一、内置不可删、全员订阅） */
export const SYSTEM_CHANNEL_CODE = 'system-assistant';

/** 地区层级标签（regions 前端页面 / server 导出统一复用） */
export const REGION_LEVEL_LABELS = {
  province: '省级',
  city: '地级',
  county: '县级',
} as const;

// ─── 系统监控告警指标 ─────────────────────────────────────────────────────────

/** 指标分组：决定告警规则表单里下拉的分组顺序 */
export const MONITOR_METRIC_GROUPS = ['infra', 'workflow', 'payment', 'openPlatform'] as const;

export type MonitorMetricGroup = (typeof MONITOR_METRIC_GROUPS)[number];

export const MONITOR_METRIC_GROUP_LABELS: Record<MonitorMetricGroup, string> = {
  infra: '基础设施',
  workflow: '流程引擎',
  payment: '支付',
  openPlatform: '开放平台',
};

/** 指标单位：决定阈值输入提示与数值格式化口径 */
export type MonitorMetricUnit = 'percent' | 'count' | 'bps' | 'ms' | 'score' | 'number';

/**
 * 指标的取值范围口径：
 * - `global`：宿主机 / 平台级指标，与租户无关，所有规则读同一个值
 * - `tenant`：业务指标，按规则所属租户过滤；平台级规则（tenantId 为空）取全平台汇总
 */
export type MonitorMetricScope = 'global' | 'tenant';

export interface MonitorMetricMeta {
  label: string;
  group: MonitorMetricGroup;
  unit: MonitorMetricUnit;
  scope: MonitorMetricScope;
  /** 指标口径说明：告警规则表单与文档共用，避免「阈值填多少」靠猜 */
  description: string;
}

/**
 * 监控告警可选指标全集（SSOT）。
 * pgEnum、Zod enum、TS union、前端下拉、告警评估器的快照字段全部由此派生，
 * 新增指标只需在此登记一项 + 在快照采集处补一个取数。
 */
export const MONITOR_METRICS = [
  // 基础设施
  'cpu', 'memory', 'disk', 'swap', 'load1', 'procCpu', 'heap', 'loopLag',
  'qps', 'errorRate', 'netRxBps', 'netTxBps', 'diskReadBps', 'diskWriteBps',
  // 流程引擎
  'workflowHealth', 'workflowBacklog', 'workflowDeadLetter', 'workflowFailureRate', 'workflowStuckRunning',
  // 支付
  'paymentFailureRate', 'paymentStuckPaying', 'paymentReconDiff', 'paymentEventBacklog', 'paymentWebhookFailureRate',
  // 开放平台
  'openApiErrorRate', 'openApiAppErrorRate', 'openWebhookFailureRate', 'openWebhookDisabledSubs',
] as const;

export type MonitorMetric = (typeof MONITOR_METRICS)[number];

export const MONITOR_METRIC_META: Record<MonitorMetric, MonitorMetricMeta> = {
  cpu: { label: 'CPU 使用率', group: 'infra', unit: 'percent', scope: 'global', description: '宿主机 CPU 使用率' },
  memory: { label: '内存使用率', group: 'infra', unit: 'percent', scope: 'global', description: '宿主机物理内存使用率' },
  disk: { label: '磁盘使用率', group: 'infra', unit: 'percent', scope: 'global', description: '所有挂载点中最高的磁盘使用率' },
  swap: { label: 'Swap 使用率', group: 'infra', unit: 'percent', scope: 'global', description: '交换分区使用率' },
  load1: { label: '系统负载(1m)', group: 'infra', unit: 'number', scope: 'global', description: '1 分钟平均负载' },
  procCpu: { label: '进程 CPU', group: 'infra', unit: 'percent', scope: 'global', description: 'Node 进程自身 CPU 占用' },
  heap: { label: '堆内存使用率', group: 'infra', unit: 'percent', scope: 'global', description: 'V8 堆内存使用率' },
  loopLag: { label: '事件循环延迟', group: 'infra', unit: 'ms', scope: 'global', description: '事件循环平均延迟' },
  qps: { label: '请求 QPS', group: 'infra', unit: 'number', scope: 'global', description: 'HTTP 每秒请求数' },
  errorRate: { label: 'HTTP 错误率', group: 'infra', unit: 'percent', scope: 'global', description: 'HTTP 5xx 占比' },
  netRxBps: { label: '网络下行', group: 'infra', unit: 'bps', scope: 'global', description: '网卡接收速率' },
  netTxBps: { label: '网络上行', group: 'infra', unit: 'bps', scope: 'global', description: '网卡发送速率' },
  diskReadBps: { label: '磁盘读取', group: 'infra', unit: 'bps', scope: 'global', description: '磁盘读取速率' },
  diskWriteBps: { label: '磁盘写入', group: 'infra', unit: 'bps', scope: 'global', description: '磁盘写入速率' },

  workflowHealth: { label: '流程引擎健康分', group: 'workflow', unit: 'score', scope: 'global', description: '最近一次引擎健康快照的综合评分（越低越差，建议用 < 比较）' },
  workflowBacklog: { label: '流程引擎队列积压', group: 'workflow', unit: 'count', scope: 'global', description: '最近一次健康快照的各队列待处理作业总数' },
  workflowDeadLetter: { label: '流程作业死信数', group: 'workflow', unit: 'count', scope: 'global', description: '重试耗尽进入死信的流程作业数' },
  workflowFailureRate: { label: '流程作业失败率', group: 'workflow', unit: 'percent', scope: 'global', description: '近 60 分钟流程作业执行失败占比' },
  workflowStuckRunning: { label: '流程作业卡死数', group: 'workflow', unit: 'count', scope: 'global', description: '领取后超过 30 分钟未结束的流程作业数' },

  paymentFailureRate: { label: '支付失败率', group: 'payment', unit: 'percent', scope: 'tenant', description: '近 60 分钟内到达终态的订单中支付失败占比（分母为成功 + 失败，不含用户主动放弃的关单）' },
  paymentStuckPaying: { label: '支付卡单数', group: 'payment', unit: 'count', scope: 'tenant', description: '进入「支付中」后超过 30 分钟仍未拿到终态结果的订单数，通常意味着渠道回调链路异常' },
  paymentReconDiff: { label: '对账差异待处理', group: 'payment', unit: 'count', scope: 'tenant', description: '对账比对出的差异条目中仍未人工处理（handleStatus=pending）的数量' },
  paymentEventBacklog: { label: '支付事件积压', group: 'payment', unit: 'count', scope: 'tenant', description: '支付事件未成功派发的条数：待派发超过 5 分钟，或重试耗尽已置失败' },
  paymentWebhookFailureRate: { label: '支付回调失败率', group: 'payment', unit: 'percent', scope: 'tenant', description: '近 60 分钟商户 Webhook 投递中失败占比' },

  openApiErrorRate: { label: '开放 API 错误率', group: 'openPlatform', unit: 'percent', scope: 'global', description: '近 60 分钟全部开放 API 调用的失败占比' },
  openApiAppErrorRate: { label: '单应用最高错误率', group: 'openPlatform', unit: 'percent', scope: 'global', description: '近 60 分钟按应用统计的最高错误率（仅统计调用量 ≥ 20 次的应用，避免小样本噪声）' },
  openWebhookFailureRate: { label: '应用 Webhook 失败率', group: 'openPlatform', unit: 'percent', scope: 'global', description: '近 60 分钟应用事件 Webhook 投递失败占比' },
  openWebhookDisabledSubs: { label: '自动停用订阅数', group: 'openPlatform', unit: 'count', scope: 'global', description: '因连续投递失败被自动停用的应用 Webhook 订阅数' },
};

export const MONITOR_METRIC_LABELS: Record<MonitorMetric, string> = Object.fromEntries(
  MONITOR_METRICS.map((metric) => [metric, MONITOR_METRIC_META[metric].label]),
) as Record<MonitorMetric, string>;

export const MONITOR_METRIC_OPTIONS: Array<{ value: MonitorMetric; label: string }> =
  createLabelOptions(MONITOR_METRICS, MONITOR_METRIC_LABELS);

/** 按分组聚合的下拉选项（分组内保持 MONITOR_METRICS 的声明顺序） */
export const MONITOR_METRIC_GROUPED_OPTIONS: Array<{
  group: MonitorMetricGroup;
  label: string;
  children: Array<{ value: MonitorMetric; label: string }>;
}> = MONITOR_METRIC_GROUPS.map((group) => ({
  group,
  label: MONITOR_METRIC_GROUP_LABELS[group],
  children: MONITOR_METRICS
    .filter((metric) => MONITOR_METRIC_META[metric].group === group)
    .map((metric) => ({ value: metric, label: MONITOR_METRIC_LABELS[metric] })),
}));

/** 需要按规则租户重新取数的业务指标 */
export const TENANT_SCOPED_MONITOR_METRICS: MonitorMetric[] =
  MONITOR_METRICS.filter((metric) => MONITOR_METRIC_META[metric].scope === 'tenant');

// ─── 告警级别 / 事件状态 / 通知派发结果（枚举 SSOT）──────────────────────────
export const MONITOR_ALERT_LEVELS = ['info', 'warning', 'critical'] as const;

export const MONITOR_ALERT_LEVEL_LABELS: Record<(typeof MONITOR_ALERT_LEVELS)[number], string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

export const MONITOR_ALERT_LEVEL_OPTIONS: Array<{ value: (typeof MONITOR_ALERT_LEVELS)[number]; label: string }> =
  MONITOR_ALERT_LEVELS.map((level) => ({ value: level, label: MONITOR_ALERT_LEVEL_LABELS[level] }));

export const MONITOR_ALERT_EVENT_STATUSES = ['firing', 'resolved'] as const;

export const MONITOR_ALERT_EVENT_STATUS_LABELS: Record<(typeof MONITOR_ALERT_EVENT_STATUSES)[number], string> = {
  firing: '告警中',
  resolved: '已恢复',
};

export const MONITOR_ALERT_EVENT_STATUS_OPTIONS:
  Array<{ value: (typeof MONITOR_ALERT_EVENT_STATUSES)[number]; label: string }> =
  MONITOR_ALERT_EVENT_STATUSES.map((status) => ({ value: status, label: MONITOR_ALERT_EVENT_STATUS_LABELS[status] }));

/**
 * 告警通知的派发结果。
 *
 * `skipped` 表示规则没有配置任何可派发的渠道，与「派发失败」是两回事——
 * 二者混为一谈会让「配了渠道却没收到通知」这类故障无法从列表上被发现。
 */
export const MONITOR_ALERT_NOTIFY_STATUSES = ['skipped', 'success', 'partial', 'failed'] as const;

export type MonitorAlertNotifyStatus = (typeof MONITOR_ALERT_NOTIFY_STATUSES)[number];

export const MONITOR_ALERT_NOTIFY_STATUS_LABELS: Record<MonitorAlertNotifyStatus, string> = {
  skipped: '未通知',
  success: '已送达',
  partial: '部分失败',
  failed: '发送失败',
};

export const MONITOR_ALERT_NOTIFY_STATUS_OPTIONS: Array<{ value: MonitorAlertNotifyStatus; label: string }> =
  MONITOR_ALERT_NOTIFY_STATUSES.map((status) => ({ value: status, label: MONITOR_ALERT_NOTIFY_STATUS_LABELS[status] }));

/**
 * 告警的人工处理状态，与系统判定的 `status`（firing / resolved）正交。
 *
 * 指标自己掉回阈值下方只说明系统恢复了，不代表有人看过、查过原因。
 * 把两者合成一个状态会让「没人管的告警」被自动恢复悄悄掩盖，因此单独建模。
 */
export const MONITOR_ALERT_HANDLE_STATUSES = ['pending', 'acknowledged', 'closed'] as const;

export type MonitorAlertHandleStatus = (typeof MONITOR_ALERT_HANDLE_STATUSES)[number];

export const MONITOR_ALERT_HANDLE_STATUS_LABELS: Record<MonitorAlertHandleStatus, string> = {
  pending: '待处理',
  acknowledged: '处理中',
  closed: '已处理',
};

export const MONITOR_ALERT_HANDLE_STATUS_OPTIONS: Array<{ value: MonitorAlertHandleStatus; label: string }> =
  MONITOR_ALERT_HANDLE_STATUSES.map((status) => ({ value: status, label: MONITOR_ALERT_HANDLE_STATUS_LABELS[status] }));

/** 告警概览的时间范围 */
export const MONITOR_ALERT_OVERVIEW_RANGES = ['24h', '7d', '30d'] as const;

export type MonitorAlertOverviewRange = (typeof MONITOR_ALERT_OVERVIEW_RANGES)[number];

export const MONITOR_ALERT_OVERVIEW_RANGE_LABELS: Record<MonitorAlertOverviewRange, string> = {
  '24h': '近 24 小时',
  '7d': '近 7 天',
  '30d': '近 30 天',
};

export const MONITOR_ALERT_OVERVIEW_RANGE_OPTIONS: Array<{ value: MonitorAlertOverviewRange; label: string }> =
  MONITOR_ALERT_OVERVIEW_RANGES.map((range) => ({ value: range, label: MONITOR_ALERT_OVERVIEW_RANGE_LABELS[range] }));

const BYTE_RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

function formatByteRate(value: number): string {
  let v = value;
  let i = 0;
  while (Math.abs(v) >= 1024 && i < BYTE_RATE_UNITS.length - 1) { v /= 1024; i += 1; }
  return `${Math.round(v * 10) / 10} ${BYTE_RATE_UNITS[i]}`;
}

/**
 * 指标数值展示格式化（告警消息、规则列表、阈值回显共用）。
 * 服务端与前端必须同源，否则「告警邮件写 12%、列表显示 12」这类偏差无法被测试发现。
 */
export function formatMonitorMetricValue(metric: MonitorMetric, value: number): string {
  switch (MONITOR_METRIC_META[metric]?.unit) {
    case 'percent': return `${Math.round(value * 10) / 10}%`;
    case 'score': return `${Math.round(value)} 分`;
    case 'count': return `${Math.round(value)} 项`;
    case 'ms': return `${Math.round(value * 100) / 100}ms`;
    case 'bps': return formatByteRate(value);
    case 'number': return `${Math.round(value * 100) / 100}`;
    default: return `${value}`;
  }
}
