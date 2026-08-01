import type { WorkflowFormSchema } from '../workflow/types';
import { REPORT_DASHBOARD_LIFECYCLE_STATUSES, REPORT_DASHBOARD_VERSION_SOURCES } from './constants';

// ════════════════════════════════════════════════════════════════════════════
// 报表中心（Report Center）—— 通用报表设计器 / 数据大屏
// ════════════════════════════════════════════════════════════════════════════

/** 数据源类型清单（单一来源，派生 type/zod/DTO，防止"半加一个类型"漂移） */
export const REPORT_DATASOURCE_TYPES = ['api', 'sql', 'mysql', 'postgresql', 'sqlserver', 'static'] as const;

/** 数据源类型：api=远程 HTTP；sql=内置只读主库；mysql/postgresql/sqlserver=外部数据库；static=静态/文件 */
export type ReportDatasourceType = typeof REPORT_DATASOURCE_TYPES[number];

export const REPORT_RESOURCE_TYPES = [
  'datasource', 'dataset', 'dashboard', 'metric', 'print_template', 'fill_template', 'asset_template',
] as const;

export type ReportResourceType = typeof REPORT_RESOURCE_TYPES[number];

export const REPORT_METRIC_TYPES = ['simple', 'ratio', 'composite'] as const;

export type ReportMetricType = typeof REPORT_METRIC_TYPES[number];

export const REPORT_METRIC_LIFECYCLE_STATUSES = ['draft', 'published', 'deprecated'] as const;

export type ReportMetricLifecycleStatus = typeof REPORT_METRIC_LIFECYCLE_STATUSES[number];

export const REPORT_ACL_SUBJECT_TYPES = ['user', 'role', 'department', 'user_group'] as const;

export type ReportAclSubjectType = typeof REPORT_ACL_SUBJECT_TYPES[number];

export const REPORT_ACL_ROLES = ['viewer', 'editor', 'owner'] as const;

export type ReportAclRole = typeof REPORT_ACL_ROLES[number];

export const REPORT_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export type ReportApprovalStatus = typeof REPORT_APPROVAL_STATUSES[number];

export const REPORT_TRANSFER_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;

export type ReportTransferStatus = typeof REPORT_TRANSFER_STATUSES[number];

export const REPORT_ENVIRONMENT_KINDS = ['development', 'testing', 'staging', 'production'] as const;

export type ReportEnvironmentKind = typeof REPORT_ENVIRONMENT_KINDS[number];

export const REPORT_PROMOTION_STATUSES = [
  'pending', 'approved', 'deploying', 'succeeded', 'failed', 'cancelled', 'rolled_back',
] as const;

export type ReportPromotionStatus = typeof REPORT_PROMOTION_STATUSES[number];

export const REPORT_DQ_RULE_TYPES = [
  'not_null', 'uniqueness', 'range', 'pattern', 'freshness', 'row_count', 'custom_sql',
] as const;

export type ReportDqRuleType = typeof REPORT_DQ_RULE_TYPES[number];

export const REPORT_DQ_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type ReportDqSeverity = typeof REPORT_DQ_SEVERITIES[number];

export const REPORT_DQ_RUN_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'cancelled'] as const;

export type ReportDqRunStatus = typeof REPORT_DQ_RUN_STATUSES[number];

export const REPORT_DQ_ANOMALY_STATUSES = ['open', 'acknowledged', 'resolved', 'ignored'] as const;

export type ReportDqAnomalyStatus = typeof REPORT_DQ_ANOMALY_STATUSES[number];

export const REPORT_MATERIALIZATION_STRATEGIES = ['full', 'incremental'] as const;

export type ReportMaterializationStrategy = typeof REPORT_MATERIALIZATION_STRATEGIES[number];

export const REPORT_SNAPSHOT_STATUSES = ['pending', 'building', 'ready', 'failed', 'expired', 'deleted'] as const;

export type ReportSnapshotStatus = typeof REPORT_SNAPSHOT_STATUSES[number];

export const REPORT_QUOTA_SCOPES = ['tenant', 'user'] as const;

export type ReportQuotaScope = typeof REPORT_QUOTA_SCOPES[number];

export const REPORT_SLA_TYPES = ['freshness', 'query_latency_p95', 'availability', 'dq_score'] as const;

export type ReportSlaType = typeof REPORT_SLA_TYPES[number];

export const REPORT_SLA_VIOLATION_STATUSES = ['open', 'acknowledged', 'resolved'] as const;

export type ReportSlaViolationStatus = typeof REPORT_SLA_VIOLATION_STATUSES[number];

export const REPORT_ASSET_TEMPLATE_TYPES = ['dashboard', 'widget', 'print', 'semantic_model'] as const;

export type ReportAssetTemplateType = typeof REPORT_ASSET_TEMPLATE_TYPES[number];

export const REPORT_CHATBI_SESSION_STATUSES = ['active', 'archived'] as const;

export type ReportChatbiSessionStatus = typeof REPORT_CHATBI_SESSION_STATUSES[number];

export const REPORT_CHATBI_MESSAGE_ROLES = ['user', 'assistant', 'system', 'tool'] as const;

export type ReportChatbiMessageRole = typeof REPORT_CHATBI_MESSAGE_ROLES[number];

export const REPORT_FILL_TEMPLATE_STATUSES = ['draft', 'published', 'disabled'] as const;

export type ReportFillTemplateStatus = typeof REPORT_FILL_TEMPLATE_STATUSES[number];

export const REPORT_FILL_RECORD_STATUSES = [
  'draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled',
] as const;

export type ReportFillRecordStatus = typeof REPORT_FILL_RECORD_STATUSES[number];

export const REPORT_FILL_SYNC_STATUSES = ['pending', 'running', 'succeeded', 'failed'] as const;

export type ReportFillSyncStatus = typeof REPORT_FILL_SYNC_STATUSES[number];

/** 外部数据库类型（凭据加密 + 走外部连接池取数） */
export const EXTERNAL_DB_TYPES = ['mysql', 'postgresql', 'sqlserver'] as const;

/** 以 SQL 文本取数的类型（内置主库 + 外部库），统一驱动 SQL 编辑 / 系统变量解析 */
export const SQL_DATASET_TYPES = ['sql', 'mysql', 'postgresql', 'sqlserver'] as const;

/** 是否外部数据库类型 */
export function isExternalDbType(t: ReportDatasourceType): boolean {
  return (EXTERNAL_DB_TYPES as readonly string[]).includes(t);
}

/** 是否以 SQL 取数（内置主库或外部库） */
export function isSqlLikeType(t: ReportDatasourceType): boolean {
  return (SQL_DATASET_TYPES as readonly string[]).includes(t);
}

/** 数据集字段（列）数据类型 */
export type ReportFieldType = 'string' | 'number' | 'date' | 'boolean';

/** 仪表盘组件类型清单（单一来源） */
export const REPORT_WIDGET_TYPES = [
  'kpi', 'table', 'pivot', 'text',
  'bar', 'line', 'area', 'dualAxis',
  'pie', 'scatter', 'radar', 'funnel', 'gauge', 'treemap',
  'flipper', 'scrollList', 'map',
  'sankey', 'wordCloud', 'liquid', 'heatmap',
  'image', 'iframe',
] as const;

/** 仪表盘组件类型 */
export type ReportWidgetType = typeof REPORT_WIDGET_TYPES[number];

/** API 数据源连接配置 */
export interface ReportApiDatasourceConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string> | null;
}

/** SQL 数据源连接配置（内置只读主库） */
export interface ReportSqlDatasourceConfig {
  connection: 'internal';
}

/** 外部数据库连接配置（mysql / postgresql）；password 仅写入，读取时脱敏 */
export interface ReportExternalDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string | null;
  /** 是否启用 SSL */
  ssl?: boolean;
  /** 读取时返回的脱敏标记（service 注入，前端只读）*/
  hasPassword?: boolean;
}

export type ReportDatasourceConfig =
  | ReportApiDatasourceConfig
  | ReportSqlDatasourceConfig
  | ReportExternalDbConfig
  | Record<string, never>;

export interface ReportDatasource {
  id: number;
  name: string;
  ownerId?: number | null;
  ownerName?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  type: ReportDatasourceType;
  config: ReportDatasourceConfig;
  status: 'enabled' | 'disabled';
  lastTestAt?: string | null;
  lastTestStatus?: 'success' | 'failed' | 'unknown' | null;
  lastTestLatencyMs?: number | null;
  lastTestError?: string | null;
  consecutiveFailures?: number;
  remark?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 数据集字段（列）定义 */
export interface ReportField {
  /** 列名（SQL 列名 / API 字段名） */
  name: string;
  /** 显示名 */
  label: string;
  type: ReportFieldType;
  /** 显示格式化（语义层）：数字/百分比/货币/日期/字典翻译 */
  format?: ReportFieldFormat;
}

/** 字段显示格式化（语义层 lite） */
export interface ReportFieldFormat {
  kind: 'number' | 'percent' | 'currency' | 'date' | 'datetime' | 'dict';
  /** number/percent/currency：小数位 */
  decimals?: number;
  /** number/currency：千分位 */
  thousands?: boolean;
  /** currency：货币符号前缀（默认 ¥） */
  currencySymbol?: string;
  /** 通用前缀/后缀 */
  prefix?: string;
  suffix?: string;
  /** dict：字典编码（取字典项 value→label 翻译） */
  dictCode?: string;
}

/** 计算字段（衍生列）：在取数结果上用表达式计算 */
export interface ReportComputedField {
  name: string;
  label: string;
  /** 表达式，引用其他列用 row.列名（如 row.gross - row.fee）*/
  expression: string;
  type?: ReportFieldType;
}

export type ReportSortOrder = 'asc' | 'desc';

export interface ReportDatasetQueryOptions {
  limit?: number;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: ReportSortOrder;
  timeoutMs?: number;
  maxRows?: number;
  maxBytes?: number;
  concurrencyKey?: string;
  quotaKey?: string;
}

/** 可视化建模：指标（聚合列） */
export interface ReportVisualMetric {
  field: string;
  aggregate: 'sum' | 'avg' | 'max' | 'min' | 'count';
  alias?: string;
}

/** 可视化建模：筛选条件 */
export interface ReportVisualFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like';
  value: string;
}

export interface ReportVisualJoin {
  type: 'inner' | 'left';
  table: string;
  alias?: string;
  sourceAlias?: string;
  sourceField: string;
  targetField: string;
}

/** 可视化建模模型（选表拖字段生成 SQL，内置库专用） */
export interface ReportVisualModel {
  table: string;
  alias?: string;
  joins?: ReportVisualJoin[];
  /** 维度列（GROUP BY） */
  dimensions: string[];
  /** 指标列（聚合） */
  metrics: ReportVisualMetric[];
  filters?: ReportVisualFilter[];
  orderBy?: { field: string; order: ReportSortOrder } | null;
  limit?: number | null;
}

/** 可视化建模：内置库列元数据 */
export interface ReportMetaColumn {
  name: string;
  type: string;
}

/** SQL 数据集内容 */
export interface ReportSqlDatasetContent {
  sql: string;
  /** 可视化建模模型（回显编辑用；SQL 为最终执行内容） */
  visual?: ReportVisualModel | null;
}

/** API 数据集内容 */
export interface ReportApiDatasetContent {
  /** 响应中数组所在路径，点分隔（如 data.list），留空表示根即数组 */
  itemsPath?: string | null;
  /** 附加查询参数 */
  params?: Record<string, string> | null;
}

/** 静态数据集内容（内联 JSON / 文件上传解析结果） */
export interface ReportStaticDatasetContent {
  /** 数据行 */
  data: Record<string, unknown>[];
  /** 列顺序（可空，缺省按首行键） */
  columns?: string[];
}

export type ReportDatasetContent =
  | ReportSqlDatasetContent
  | ReportApiDatasetContent
  | ReportStaticDatasetContent
  | Record<string, never>;

export interface ReportDataset {
  id: number;
  name: string;
  ownerId?: number | null;
  ownerName?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  datasourceId: number;
  /** JOIN 冗余：数据源名称 */
  datasourceName?: string | null;
  /** 从数据源继承的类型 */
  type: ReportDatasourceType;
  content: ReportDatasetContent;
  fields: ReportField[];
  /** 参数定义（SQL ${name} 占位 / API 注入） */
  params: ReportDatasetParam[];
  /** 计算字段（衍生列） */
  computedFields: ReportComputedField[];
  /** 结果缓存 TTL（秒），0=不缓存 */
  cacheTtl: number;
  /** 物化快照配置（定时刷新到持久层，给大屏降压） */
  materialize?: ReportDatasetMaterialize;
  /** 行级权限规则（仅 SQL 型数据集生效） */
  rowRules?: ReportRowRule[];
  status: 'enabled' | 'disabled';
  remark?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 数据集行级权限规则（仅 SQL 型数据集生效）。
 * 取数时：登录用户命中的规则（角色匹配）以 OR 拼接为 WHERE 包裹原查询；
 * 未命中任何规则 = 不受限；超级管理员与无用户上下文场景（Cron/公开分享）跳过。
 */
export interface ReportRowRule {
  /** 生效角色 code 列表；空/缺省 = 对所有登录用户生效 */
  roles?: string[];
  /** WHERE 片段（不含 WHERE 关键字），可引用 ${__userId} 等系统变量与数据集参数；禁止分号 */
  where: string;
  enabled?: boolean;
  remark?: string;
}

/** 数据集物化快照配置 */
export interface ReportDatasetMaterialize {
  /** 是否启用物化（启用后取数优先返回快照，忽略运行时参数） */
  enabled: boolean;
  /** 刷新 Cron（留空=仅手动刷新） */
  cron?: string;
  /** full=全量替换；incremental=按 keyField 与增量窗口合并 */
  strategy?: ReportMaterializationStrategy;
  keyField?: string | null;
  deltaWindowMinutes?: number | null;
  /** 最近刷新时间（展示用，只读，服务端注入） */
  refreshedAt?: string | null;
  /** 最近刷新时间戳（epoch 毫秒，调度比较用，避免展示串再解析的时区歧义） */
  refreshedAtMs?: number | null;
}

/** 数据集取数结果 */
export interface ReportResultField extends ReportField {
  source?: 'declared' | 'computed' | 'inferred';
}

export interface ReportDataResult {
  columns: string[];
  fields: ReportResultField[];
  rows: Record<string, unknown>[];
  total?: number | null;
  bytes?: number | null;
  truncated?: boolean;
  truncatedReason?: string | null;
  quotaRemaining?: number | null;
  costUnits?: number | null;
  queueDurationMs?: number | null;
}

export interface ReportWidgetDataError {
  code: number;
  message: string;
}

export interface ReportWidgetDataResult {
  data: ReportDataResult | null;
  error: ReportWidgetDataError | null;
  durationMs: number;
  cacheHit: boolean;
}

export interface ReportDashboardDataRequest {
  filters?: Record<string, unknown>;
  limit?: number;
  widgetQueries?: Record<string, ReportDatasetQueryOptions>;
}

export interface ReportDatasetExecutionLog {
  id: number;
  datasetId: number | null;
  datasetName?: string | null;
  datasourceId: number | null;
  datasourceName?: string | null;
  userId: number | null;
  username?: string | null;
  tenantId: number | null;
  scene: string;
  sourceRefId?: string | null;
  durationMs: number;
  rowCount: number | null;
  bytes?: number | null;
  truncated?: boolean;
  slow?: boolean;
  cacheHit: boolean;
  success: boolean;
  errorCode?: number | null;
  errorMessage?: string | null;
  paramKeys?: string[];
  executedAt: string;
}

export interface ReportLookupOption {
  id: number;
  name: string;
  status?: 'enabled' | 'disabled' | null;
  type?: ReportDatasourceType | null;
  categoryId?: number | null;
  categoryName?: string | null;
  datasourceId?: number | null;
  datasourceName?: string | null;
  dashboardCount?: number;
}

export interface ReportBatchStatusInput {
  ids: number[];
  status: 'enabled' | 'disabled';
}

export interface ReportCloneInput {
  name?: string;
}

export interface ReportRuntimeGovernance {
  slowQueryMs: number;
  dashboardMaxConcurrent: number;
  datasetMaxRows: number;
  datasetMaxBytes: number;
  tenantMaxConcurrent?: number;
  userMaxConcurrent?: number;
  tenantDailyQueryLimit?: number;
  userDailyQueryLimit?: number;
  tenantDailyCostLimit?: number;
  userDailyCostLimit?: number;
}

export interface ReportExecutionStatsSlowItem {
  datasetId: number | null;
  datasetName?: string | null;
  datasourceId: number | null;
  datasourceName?: string | null;
  scene: string;
  count: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastExecutedAt: string | null;
}

export interface ReportExecutionStats {
  total: number;
  successCount: number;
  successRate: number;
  p95DurationMs: number;
  avgDurationMs: number;
  cacheHitRate: number;
  slowCount: number;
  truncatedCount: number;
  governance: ReportRuntimeGovernance;
  capacity: {
    globalLimit: number;
    running: number;
    queueDepth: number;
    datasourceQueues: number;
  };
  series: Array<{
    bucket: string;
    queries: number;
    rows: number;
    bytes: number;
    costUnits: number;
    avgDurationMs: number;
    queueMs: number;
  }>;
  topSlowQueries: ReportExecutionStatsSlowItem[];
}

/** 网格布局项（对齐 react-grid-layout 的 Layout item） */
export interface ReportGridItem {
  /** 与 widget.i 对应 */
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** 自由画布定位项（绝对像素，用于大屏 canvas 模式） */
export interface ReportCanvasItem {
  /** 与 widget.i 对应 */
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 层级 */
  z?: number;
}

/** 组件字段映射 + 图表选项 */
export interface ReportWidgetOptions {
  /** 柱/线/饼：分类（x 轴）字段 */
  categoryField?: string;
  /** 柱/线/饼：指标（y 轴）字段，可多列 */
  valueFields?: string[];
  /** 指标卡：取值列 */
  valueField?: string;
  /** 指标卡：聚合方式 */
  aggregate?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'first';
  /** 指标卡：单位后缀 */
  unit?: string;
  /** 表格：展示列（留空=全部字段） */
  columns?: ReportField[];
  // ── 图表通用 ──
  /** 折线/面积：平滑曲线 */
  smooth?: boolean;
  /** 柱/面积：堆叠 */
  stack?: boolean;
  /** 柱/面积：百分比堆叠 */
  percent?: boolean;
  /** 柱：水平条形 */
  horizontal?: boolean;
  /** 是否显示数据标签 */
  showLabel?: boolean;
  // ── 组合图（双轴）──
  /** 右轴（次坐标）指标字段 */
  secondaryFields?: string[];
  /** 右轴渲染为折线（否则柱） */
  secondaryAsLine?: boolean;
  // ── 排序 / TopN ──
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  topN?: number;
  // ── 指标卡增强 ──
  /** 对比字段（环比/同比基准） */
  compareField?: string;
  /** 目标值（常量） */
  targetValue?: number;
  /** 迷你趋势字段（按 categoryField 排列） */
  trendField?: string;
  // ── 数值格式 ──
  decimals?: number;
  prefix?: string;
  // ── 表格增强 ──
  /** 分页大小（0=不分页） */
  pageSize?: number;
  /** 显示合计行 */
  showSummary?: boolean;
  /** 条件格式规则 */
  conditionalFormats?: ReportConditionalFormat[];
  // ── 透视表 ──
  pivotRows?: string[];
  pivotColumns?: string[];
  pivotValueField?: string;
  pivotAggregate?: 'sum' | 'avg' | 'max' | 'min' | 'count';
  // ── 文本组件 ──
  /** 文本内容（支持 ${filterId} 占位） */
  text?: string;
  // ── 仪表盘 gauge / 雷达 ──
  min?: number;
  max?: number;
  // ── 大屏：数字翻牌器 flipper ──
  /** 翻牌固定位数（不足补 0） */
  flipDigits?: number;
  // ── 大屏：滚动榜单 scrollList ──
  /** 滚动速度（行/秒），0=不滚动 */
  scrollSpeed?: number;
  /** 显示排名序号 */
  showRank?: boolean;
  // ── 大屏：地图 map ──
  /** geojson 地图数据 URL（懒加载注册） */
  mapGeojsonUrl?: string;
  /** 已注册地图名称（默认取 URL 推导） */
  mapName?: string;
  /** 区域名字段（匹配 geojson 的 name） */
  areaField?: string;
  // ── 桑基图 sankey ──
  /** 源节点字段 */
  sourceField?: string;
  /** 目标节点字段 */
  targetField?: string;
  // ── 词云 wordCloud ──
  /** 词语字段（沿用 categoryField 亦可） */
  wordField?: string;
  // ── 热力图 heatmap ──
  /** 热力图 X 字段（沿用 categoryField）、Y 字段 */
  yField?: string;
  // ── 水波球 liquid ──（沿用 valueField + max）
  // ── 媒体：图片 image / 内嵌 iframe ──
  /** 资源 URL（image 图片地址 / iframe 内嵌地址；支持 ${filterId} 占位） */
  src?: string;
  /** 图片填充方式 */
  fit?: 'contain' | 'cover' | 'fill';
}

/** 仪表盘组件配置 */
export interface ReportWidget {
  /** 组件 id（与 layout item 的 i 对应） */
  i: string;
  type: ReportWidgetType;
  title: string;
  datasetId?: number | null;
  /** 语义指标来源；仅 KPI/gauge/flipper/liquid 组件使用，优先于 datasetId。 */
  metricId?: number | null;
  options: ReportWidgetOptions;
  /** 全局筛选器 → 数据集参数 绑定 */
  paramBindings?: ReportWidgetParamBinding[];
  /** 点击联动：点击分类写入某筛选器 */
  interaction?: ReportWidgetInteraction;
  /** 钻取配置 */
  drilldown?: ReportWidgetDrilldown;
  /** 组件样式 */
  style?: ReportWidgetStyle;
  /** 多屏轮播：所属页码（1 基，缺省=第 1 页） */
  page?: number;
}

export interface ReportDashboard {
  id: number;
  name: string;
  ownerId?: number | null;
  ownerName?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  layout: ReportGridItem[];
  /** 自由画布定位（canvas 模式） */
  canvasLayout: ReportCanvasItem[];
  widgets: ReportWidget[];
  /** 全局筛选器 */
  filters: ReportFilter[];
  /** 全局配置（主题/大屏/自动刷新） */
  config: ReportDashboardConfig;
  categoryId?: number | null;
  categoryName?: string | null;
  /** 当前用户是否已收藏（列表/详情按需附加） */
  favorited?: boolean;
  status: 'enabled' | 'disabled';
  lifecycleStatus: ReportDashboardLifecycleStatus;
  revision: number;
  publishedSnapshot?: ReportDashboardSnapshot | null;
  publishedAt?: string | null;
  publishedBy?: number | null;
  publishedByName?: string | null;
  remark?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 报表中心 · 第二/三期扩展类型 ──────────────────────────────────────────────

/** 数据集参数定义 */
export interface ReportDatasetParam {
  name: string;
  label: string;
  type: ReportFieldType;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
}

/** 表格条件格式规则 */
export interface ReportConditionalFormat {
  field: string;
  op: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq' | 'between';
  value: number;
  value2?: number;
  color?: string;
  background?: string;
}

/** 全局筛选器类型 */
export type ReportFilterType = 'date' | 'daterange' | 'select' | 'multiSelect' | 'input' | 'numberRange';

/** 筛选器选项来源 */
export interface ReportFilterOptionSource {
  kind: 'static' | 'dataset';
  options?: { value: string; label: string }[];
  datasetId?: number | null;
  valueField?: string;
  labelField?: string;
}

/** 仪表盘全局筛选器 */
export interface ReportFilter {
  id: string;
  label: string;
  type: ReportFilterType;
  defaultValue?: unknown;
  optionSource?: ReportFilterOptionSource;
  /** 栅格宽度（1-24） */
  width?: number;
}

/** 筛选器 → 数据集参数 绑定 */
export interface ReportWidgetParamBinding {
  filterId: string;
  param: string;
}

/** 点击联动配置 */
export interface ReportWidgetInteraction {
  enabled?: boolean;
  /** 点击分类时写入的目标筛选器 id */
  setFilterId?: string;
}

/** 钻取配置 */
export interface ReportWidgetDrilldown {
  enabled?: boolean;
  type?: 'fields' | 'dashboard' | 'url';
  /** type=fields：维度层级（逐层替换 categoryField） */
  fields?: string[];
  /** type=dashboard：目标仪表盘 */
  targetDashboardId?: number | null;
  /** type=url：目标外链（支持 {value} 占位） */
  url?: string;
  /** 传参：点击值写入目标筛选器/参数名 */
  paramName?: string;
}

/** 组件样式 */
export interface ReportWidgetStyle {
  background?: string;
  showHeader?: boolean;
  borderless?: boolean;
}

/** 大屏自由画布设置 */
export interface ReportScreenConfig {
  /** 设计宽度（px） */
  width: number;
  /** 设计高度（px） */
  height: number;
  /** 背景色 */
  background?: string;
  /** 背景图 URL */
  backgroundImage?: string;
  /** 缩放方式：fit=等比铺满(letterbox)，width=按宽度铺满，full=拉伸 */
  scaleMode?: 'fit' | 'width' | 'full';
}

/** 仪表盘全局配置 */
export interface ReportDashboardConfig {
  theme?: 'light' | 'dark';
  /** 布局模式：grid=响应式栅格；canvas=自由画布大屏 */
  layoutMode?: 'grid' | 'canvas';
  /** 大屏模式（全屏自适应缩放） */
  screen?: boolean;
  /** 自由画布大屏设置（layoutMode=canvas 时生效） */
  screenConfig?: ReportScreenConfig;
  /** 自动刷新间隔（秒，0=关闭） */
  refreshInterval?: number;
  /** 多屏轮播（大屏分页 + 自动切换） */
  carousel?: ReportCarouselConfig;
  /** 嵌入宿主安全策略；未配置来源时 SDK 仅接受同源宿主消息 */
  embed?: {
    allowedOrigins?: string[];
    readOnly?: boolean;
  };
}

/** 多屏轮播配置 */
export interface ReportCarouselConfig {
  /** 是否启用多屏轮播 */
  enabled?: boolean;
  /** 总页数（>=1） */
  pageCount?: number;
  /** 自动切换间隔（秒，0=不自动切换） */
  intervalSec?: number;
  /** 是否显示页码指示点 */
  showDots?: boolean;
}

/** 仪表盘分类 */
export interface ReportDashboardCategory {
  id: number;
  name: string;
  sort: number;
  dashboardCount?: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReportDashboardLifecycleStatus = typeof REPORT_DASHBOARD_LIFECYCLE_STATUSES[number];

export type ReportDashboardVersionSource = typeof REPORT_DASHBOARD_VERSION_SOURCES[number];

/** 仪表盘快照内容（发布态 / 版本历史统一复用） */
export interface ReportDashboardSnapshot {
  name: string;
  layout: ReportGridItem[];
  canvasLayout?: ReportCanvasItem[];
  widgets: ReportWidget[];
  filters: ReportFilter[];
  config: ReportDashboardConfig;
  categoryId?: number | null;
  remark?: string | null;
}

/** 仪表盘版本快照内容 */
export type ReportDashboardVersionSnapshot = ReportDashboardSnapshot;

/** 仪表盘版本 */
export interface ReportDashboardVersion {
  id: number;
  dashboardId: number;
  version: number;
  snapshot: ReportDashboardVersionSnapshot;
  source: ReportDashboardVersionSource;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
}

export interface ReportDashboardVersionWidgetChange {
  id: string;
  title: string;
  type: ReportWidgetType;
  changedFields?: string[];
}

export interface ReportDashboardVersionDiff {
  leftLabel: string;
  rightLabel: string;
  summary: string[];
  widgets: {
    added: ReportDashboardVersionWidgetChange[];
    removed: ReportDashboardVersionWidgetChange[];
    modified: ReportDashboardVersionWidgetChange[];
  };
  layoutChanged: boolean;
  filtersChanged: boolean;
  configChanged: boolean;
  metadataChanged: boolean;
}

/** 公开分享链接 */
export interface ReportDashboardShare {
  id: number;
  dashboardId: number;
  token: string;
  enabled: boolean;
  hasPassword?: boolean;
  expireAt?: string | null;
  maxAccessCount?: number | null;
  allowedCidrs?: string[];
  allowedIps?: string[];
  /** 累计访问次数（只读聚合，含被拒绝的尝试） */
  accessCount?: number;
  /** 最近访问时间（只读聚合） */
  lastAccessAt?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDashboardEmbedToken {
  id: number;
  dashboardId: number;
  token: string;
  allowedFilterIds: string[];
  fixedFilters: Record<string, unknown>;
  expireAt?: string | null;
  revokedAt?: string | null;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 通知渠道（预警/订阅共用）：邮件 / 站内信 / Webhook（企微/钉钉机器人或通用端点） */
export type ReportNotifyChannel = 'email' | 'inApp' | 'webhook';

export type ReportScheduleMisfirePolicy = 'skip' | 'fire_once';

export type ReportDeliveryTargetType = 'subscription' | 'alert' | 'sla';

export type ReportDeliveryTriggerType = 'manual' | 'scheduled' | 'trigger' | 'recover';

export type ReportDeliveryStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled';

export interface ReportDeliveryAttempt {
  id: number;
  runId: number;
  channel: ReportNotifyChannel;
  attempt: number;
  status: ReportDeliveryStatus;
  durationMs?: number | null;
  errorMessage?: string | null;
  payloadSummary?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDeliveryRun {
  id: number;
  targetType: ReportDeliveryTargetType;
  subscriptionId?: number | null;
  alertRuleId?: number | null;
  slaRuleId?: number | null;
  dashboardId?: number | null;
  datasetId?: number | null;
  targetName?: string | null;
  triggerType: ReportDeliveryTriggerType;
  status: ReportDeliveryStatus;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  durationMs?: number | null;
  errorMessage?: string | null;
  payloadSummary?: Record<string, unknown> | null;
  lastValue?: number | null;
  triggered?: boolean | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: number | null;
  acknowledgedByName?: string | null;
  acknowledgeNote?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  nextRetryAt?: string | null;
  attempts?: ReportDeliveryAttempt[];
  createdAt: string;
  updatedAt: string;
}

/** 订阅推送（按 Cron 推送报表摘要） */
export interface ReportDashboardSubscription {
  id: number;
  dashboardId: number;
  dashboardName?: string | null;
  cron: string;
  timezone: string;
  misfirePolicy: ReportScheduleMisfirePolicy;
  channels: ReportNotifyChannel[];
  /** 收件人邮箱（逗号分隔）；inApp 推给创建者 */
  recipients?: string | null;
  /** Webhook 通知地址（channels 含 webhook 时必填） */
  webhookUrl?: string | null;
  enabled: boolean;
  remark?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: ReportDeliveryStatus | null;
  lastDeliveryError?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 公开分享渲染 DTO（精简、无敏感字段） */
export interface ReportPublicDashboard {
  name: string;
  layout: ReportGridItem[];
  canvasLayout: ReportCanvasItem[];
  widgets: ReportWidget[];
  filters: ReportFilter[];
  config: ReportDashboardConfig;
  filterOptions?: Record<string, Array<{ value: string; label: string }>>;
}

export interface ReportPublicAccessSession {
  accessSessionToken: string;
  expiresAt: string;
  dashboard: ReportPublicDashboard;
}

// ─── 报表中心 · 第六期：类 Excel 单据/中国式报表 ──────────────────────────────

/** 打印报表单元格样式子集（不耦合 Univer，供归一化网格 + 导出复用） */
export interface ReportPrintBorderSide {
  style?: 'thin' | 'medium' | 'dashed' | 'dotted' | 'double';
  color?: string;
}

export interface ReportPrintBorder {
  top?: ReportPrintBorderSide;
  right?: ReportPrintBorderSide;
  bottom?: ReportPrintBorderSide;
  left?: ReportPrintBorderSide;
}

export interface ReportPrintCellStyle {
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  /** 是否描边（兼容旧 boolean；新结构支持四边独立边框） */
  border?: boolean | ReportPrintBorder;
  /** 自动换行 */
  wrap?: boolean;
}

export interface ReportPrintCellImage {
  src: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover';
  alt?: string;
}

export interface ReportPrintSubreportCell {
  templateId: number;
  datasetKey?: string;
  paramBindings?: Record<string, string>;
}

export interface ReportPrintDatasetBinding {
  key: string;
  datasetId: number;
  /** 静态参数（兼容既有模板）；参数名仍须在目标数据集中声明 */
  params?: Record<string, unknown>;
  /** 目标数据集参数名 -> 打印模板参数名 */
  paramBindings?: Record<string, string>;
  /** 单绑定行数上限，不能超过渲染请求的总上限 */
  rowLimit?: number;
  parentKey?: string | null;
  parentField?: string | null;
  childField?: string | null;
}

export interface ReportPrintCrosstabValueField {
  field: string;
  aggregate: 'sum' | 'avg' | 'max' | 'min' | 'count';
  label?: string;
}

export interface ReportPrintCrosstabConfig {
  rowFields: string[];
  columnFields: string[];
  /** 多指标配置；新模板应使用此字段 */
  valueFields?: ReportPrintCrosstabValueField[];
  /** 旧模板单指标配置 */
  valueField?: string;
  /** 旧模板单指标聚合方式 */
  aggregate?: 'sum' | 'avg' | 'max' | 'min' | 'count';
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  emptyValue?: string | number | null;
  nullLabel?: string;
  /** 模板中用于继承样式/行高的表头、数据、总计行（0-based） */
  headerRow?: number;
  dataRow?: number;
  totalRow?: number;
  /** 交叉表起始列（0-based） */
  startColumn?: number;
}

export interface ReportPrintRepeatBlock {
  id: string;
  datasetKey: string;
  range: ReportPrintRowRange;
}

/** 打印报表单元格（归一化网格项） */
export interface ReportPrintCell {
  row: number;
  col: number;
  /** 原始值/表达式文本：${field}=纵向扩展明细，#{field}=标量，${SUM(field)}=聚合，其余=字面量 */
  v?: string | number | boolean | null;
  s?: ReportPrintCellStyle;
  kind?: 'text' | 'formula' | 'image' | 'qrcode' | 'barcode' | 'subreport';
  /** Excel/Univer 公式串（尽量保留，不在服务端求值） */
  formula?: string;
  /** 数字/日期格式（如 #,##0.00） */
  numFmt?: string;
  image?: ReportPrintCellImage;
  /** 多数据集模板中此单元格使用的数据集绑定 key */
  datasetKey?: string;
  /** 子报表单元格配置 */
  subreport?: ReportPrintSubreportCell;
}

/** 合并单元格区域 */
export interface ReportPrintMerge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

/** 归一化打印网格（单 sheet，渲染/导出引擎的统一中间表示） */
export interface ReportPrintGrid {
  rows: number;
  cols: number;
  /** 列宽（px，按列索引） */
  colWidths?: number[];
  /** 行高（px，按行索引） */
  rowHeights?: number[];
  cells: ReportPrintCell[];
  merges?: ReportPrintMerge[];
}

export interface ReportPrintRowRange {
  start: number;
  end: number;
}

export interface ReportPrintSheet {
  id: string;
  name: string;
  /** Sheet 级默认数据集绑定 key */
  datasetKey?: string;
  grid: ReportPrintGrid;
  pageConfig?: ReportPrintPageConfig;
  /** 同一 Sheet 内可按不同数据集重复指定模板带；重复带不可相互重叠 */
  repeatBlocks?: ReportPrintRepeatBlock[];
}

/** 页面/打印配置 */
export interface ReportPrintPageConfig {
  paper?: 'A4' | 'A3' | 'A5' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  /** 页边距（mm） */
  margin?: { top: number; right: number; bottom: number; left: number };
  /** 页眉文本（支持 ${param} 与 {page}/{pages}/{date} 占位） */
  header?: string;
  /** 页脚文本 */
  footer?: string;
  /** 套打背景图 URL（叠加预印表单） */
  backgroundImage?: string;
  /** 手动强制分页（逻辑行号，1-based，作用于渲染后的正文行） */
  pageBreaks?: number[];
  /** 每页重复表头的模板行范围 */
  repeatHeaderRows?: ReportPrintRowRange | null;
  /** 固定每页正文行数（不含重复表头） */
  rowsPerPage?: number;
  /** 按纸张可用高度自动计算分页 */
  calculateRowsPerPage?: boolean;
  /** 明细扩展方向：vertical=纵向明细带；horizontal=横向扩展列；crosstab=交叉表 */
  detailDirection?: 'vertical' | 'horizontal' | 'crosstab';
  crosstab?: ReportPrintCrosstabConfig;
  /** 分组字段 */
  groupByFields?: string[];
  /** 组头模板行范围 */
  groupHeaderRows?: ReportPrintRowRange | null;
  /** 组尾/组小计模板行范围 */
  groupFooterRows?: ReportPrintRowRange | null;
  /** 页小计模板行范围 */
  pageSubtotalRows?: ReportPrintRowRange | null;
  /** 总计模板行范围 */
  totalRows?: ReportPrintRowRange | null;
}

/** 打印报表内容：Univer 工作簿快照(编辑用) + 归一化网格/多 Sheet(渲染/导出用) */
export interface ReportPrintContent {
  /** Univer IWorkbookData 快照（设计器加载用，结构由前端维护） */
  workbook?: unknown;
  /** 归一化单 sheet（旧版兼容） */
  grid?: ReportPrintGrid;
  /** 归一化多 sheet（新版） */
  sheets?: ReportPrintSheet[];
  /** 模板可绑定多个数据集；旧版 datasetId 仍作为主数据集 */
  datasetBindings?: ReportPrintDatasetBinding[];
}

/** 打印报表模板 */
export interface ReportPrintTemplate {
  id: number;
  name: string;
  ownerId?: number | null;
  ownerName?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  datasetId?: number | null;
  datasetName?: string | null;
  content: ReportPrintContent;
  params: ReportDatasetParam[];
  pageConfig: ReportPrintPageConfig;
  status: 'enabled' | 'disabled';
  remark?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportPrintRenderPage {
  sheetId: string;
  sheetName: string;
  pageNumber: number;
  totalPages: number;
  grid: ReportPrintGrid;
  pageConfig: ReportPrintPageConfig;
  headerText?: string;
  footerText?: string;
}

export interface ReportPrintSheetRenderResult {
  id: string;
  name: string;
  grid: ReportPrintGrid;
  pageConfig: ReportPrintPageConfig;
  pages: ReportPrintRenderPage[];
  rowCount: number;
}

/** 填充后的打印报表（渲染/导出结果） */
export interface ReportPrintRenderResult {
  name: string;
  /** 兼容旧单 sheet 返回结构：取首个 sheet 的完整网格 */
  grid: ReportPrintGrid;
  pageConfig: ReportPrintPageConfig;
  /** 兼容旧预览：平铺后的页面列表 */
  pages: ReportPrintRenderPage[];
  /** 新版多 sheet 渲染结果 */
  sheets: ReportPrintSheetRenderResult[];
}

export type ReportPrintDatasetRows = Record<string, Array<Record<string, unknown>>>;

export interface ReportPrintResolvedSubreport {
  sheetId: string;
  row: number;
  col: number;
  templateId: number;
  result: ReportPrintRenderResult;
}

export interface ReportPrintRenderOptions {
  datasets?: ReportPrintDatasetRows;
  bindings?: ReportPrintDatasetBinding[];
  subreports?: ReportPrintResolvedSubreport[];
  /** 已由调用方按系统时间规范格式化的渲染时间 */
  renderedAt?: string;
  crosstabBudget?: {
    maxDynamicColumns?: number;
    maxCells?: number;
    maxBytes?: number;
  };
}

// ─── 报表中心 · 第八期：数据预警 + 协作 ────────────────────────────────────────

/** 预警比较运算符 */
export type ReportAlertOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

/** 预警聚合方式 */
export type ReportAlertAggregate = 'sum' | 'avg' | 'max' | 'min' | 'count' | 'first';

/** 数据预警规则 */
export interface ReportAlertRule {
  id: number;
  name: string;
  /** 监控的数据集 */
  datasetId: number | null;
  datasetName?: string | null;
  /** 指标预警来源；设置后 datasetId 必须为空。 */
  metricId?: number | null;
  metricName?: string | null;
  /** 监控字段（count 可空） */
  field?: string | null;
  /** 分组维度（可空=全局聚合；有值=按组聚合，任一组命中即触发） */
  groupByField?: string | null;
  /** 聚合方式 */
  aggregate: ReportAlertAggregate;
  /** 比较运算符 */
  op: ReportAlertOp;
  /** 阈值 */
  threshold: number;
  /** 评估 Cron（留空=仅手动） */
  cron?: string | null;
  timezone: string;
  misfirePolicy: ReportScheduleMisfirePolicy;
  /** 通知渠道 */
  channels: ReportNotifyChannel[];
  /** 收件人邮箱（逗号分隔）；inApp 推给创建者 */
  recipients?: string | null;
  /** Webhook 通知地址（channels 含 webhook 时必填） */
  webhookUrl?: string | null;
  /** 静默期（分钟）：持续触发时，距上次通知不足该时长不重复通知；0=每次触发都通知 */
  silenceMins: number;
  /** 从触发恢复正常时是否发送恢复通知 */
  notifyOnRecover: boolean;
  enabled: boolean;
  /** 最近评估时间（只读） */
  lastCheckedAt?: string | null;
  /** 最近是否触发（只读） */
  lastTriggered?: boolean | null;
  /** 最近评估的实际值（只读） */
  lastValue?: number | null;
  /** 最近一次发送通知时间（只读，静默窗口基准） */
  lastNotifiedAt?: string | null;
  nextRunAt?: string | null;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: ReportDeliveryStatus | null;
  lastDeliveryError?: string | null;
  remark?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 预警评估命中组明细（分组维度评估时返回） */
export interface ReportAlertEvalHit {
  group: string;
  value: number;
}

/** 预警评估结果 */
export interface ReportAlertEvalResult {
  value: number;
  triggered: boolean;
  status?: ReportDeliveryStatus | null;
  deliveryRunId?: number | null;
  /** 分组评估时的命中组明细（最多 10 条） */
  hits?: ReportAlertEvalHit[];
}

/** 数据集下游引用（血缘：删除保护与影响分析） */
export interface ReportDatasetRefs {
  /** 引用该数据集的仪表盘（组件绑定或筛选器动态选项） */
  dashboards: Array<{ id: number; name: string; widgets: string[]; filterIds: string[] }>;
  printTemplates: Array<{ id: number; name: string }>;
  metrics: Array<{ id: number; code: string; name: string }>;
  alerts: Array<{ id: number; name: string }>;
  subscriptions?: Array<{ id: number; dashboardId: number; name: string }>;
  shares?: Array<{ id: number; dashboardId: number; name: string }>;
  embedTokens?: Array<{ id: number; dashboardId: number; name: string }>;
  nodes?: Array<{
    id: string;
    type: 'datasource' | 'dataset' | 'metric' | 'dashboard' | 'widget' | 'filter' | 'print' | 'alert' | 'subscription' | 'share' | 'embed';
    refId?: number | null;
    parentId?: string | null;
    label: string;
    meta?: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    label?: string | null;
  }>;
}

/** 仪表盘评论（协作批注） */
export interface ReportDashboardComment {
  id: number;
  dashboardId: number;
  /** 关联组件 id（可空，整盘评论） */
  widgetId?: string | null;
  parentId?: number | null;
  content: string;
  userId?: number | null;
  userName?: string | null;
  userAvatar?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
  resolvedByName?: string | null;
  deletedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  replies?: ReportDashboardComment[];
  canEdit?: boolean;
  canDelete?: boolean;
  canResolve?: boolean;
}

// ─── 报表平台化 P2：治理、质量、ChatBI 与填报 ────────────────────────────────────

export interface ReportFolder {
  id: number;
  tenantId: number | null;
  parentId: number | null;
  name: string;
  resourceType: ReportResourceType;
  ownerId: number | null;
  ownerName?: string | null;
  sort: number;
  status: 'enabled' | 'disabled';
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportFolderTreeNode extends ReportFolder {
  children?: ReportFolderTreeNode[];
  resourceCount?: number;
}

export interface ReportResourceSummary {
  resourceType: ReportResourceType;
  resourceId: number;
  name: string;
  ownerId: number | null;
  ownerName?: string | null;
  folderId: number | null;
  folderName?: string | null;
  status?: string | null;
  updatedAt: string;
}

export interface ReportPlatformListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  resourceType?: ReportResourceType;
  folderId?: number | null;
  ownerId?: number | null;
  status?: string;
  startAt?: string;
  endAt?: string;
}

export interface ReportMetric {
  id: number;
  tenantId: number | null;
  folderId: number | null;
  folderName?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  code: string;
  name: string;
  description?: string | null;
  type: ReportMetricType;
  datasetId: number;
  datasetName?: string | null;
  sourceField?: string | null;
  formula?: string | null;
  aggregate?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'distinct_count' | null;
  dimensions: string[];
  timeField?: string | null;
  unit?: string | null;
  format?: string | null;
  caliber?: string | null;
  lifecycleStatus: ReportMetricLifecycleStatus;
  revision: number;
  publishedSnapshot?: Record<string, unknown> | null;
  publishedAt?: string | null;
  publishedBy?: number | null;
  deprecatedAt?: string | null;
  deprecatedBy?: number | null;
  deprecationReason?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportMetricEvaluation {
  metricId: number;
  code: string;
  value: number;
  formattedValue: string;
  unit?: string | null;
  durationMs: number;
  cacheHit: boolean;
}

export interface ReportMetricRefs {
  dashboards: Array<{ id: number; name: string; widgets: string[] }>;
  alerts: Array<{ id: number; name: string }>;
  metrics: Array<{ id: number; code: string; name: string }>;
}

export interface ReportMetricLookupOption {
  id: number;
  name: string;
  code: string;
  status: ReportMetricLifecycleStatus;
  datasetId: number;
  type: 'metric';
}

export interface ReportResourceAcl {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  subjectType: ReportAclSubjectType;
  subjectId: number;
  role: ReportAclRole;
  inheritFromFolder: boolean;
  expiresAt?: string | null;
  grantedBy: number | null;
  grantedByName?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ReportApprovalAction = 'publish' | 'promote' | 'deprecate';

export interface ReportPublishApproval {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  resourceName?: string | null;
  action: ReportApprovalAction;
  requestedRevision: number;
  snapshot: Record<string, unknown>;
  status: ReportApprovalStatus;
  requestedBy: number | null;
  requestedByName?: string | null;
  requestedAt: string;
  decidedBy?: number | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportResourceTransfer {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  resourceName?: string | null;
  fromOwnerId: number | null;
  fromOwnerName?: string | null;
  toOwnerId: number;
  toOwnerName?: string | null;
  status: ReportTransferStatus;
  reason?: string | null;
  requestedBy: number | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportEnvironment {
  id: number;
  tenantId: number | null;
  code: string;
  name: string;
  kind: ReportEnvironmentKind;
  description?: string | null;
  baseUrl?: string | null;
  config: Record<string, unknown>;
  isDefault: boolean;
  status: 'enabled' | 'disabled';
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportEnvironmentPromotion {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  resourceName?: string | null;
  sourceEnvironmentId: number;
  sourceEnvironmentName?: string | null;
  targetEnvironmentId: number;
  targetEnvironmentName?: string | null;
  sourceRevision: number;
  sourceSnapshot: Record<string, unknown>;
  targetSnapshot?: Record<string, unknown> | null;
  status: ReportPromotionStatus;
  requestedBy: number | null;
  approvedBy?: number | null;
  deployedBy?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  rollbackSnapshot?: Record<string, unknown> | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDqRuleConfig {
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
  maxAgeMinutes?: number | null;
  minRows?: number | null;
  maxRows?: number | null;
  sql?: string | null;
}

export interface ReportDqRule {
  id: number;
  tenantId: number | null;
  datasetId: number;
  datasetName?: string | null;
  name: string;
  type: ReportDqRuleType;
  field?: string | null;
  severity: ReportDqSeverity;
  config: ReportDqRuleConfig;
  cron?: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt?: string | null;
  lastStatus?: ReportDqRunStatus | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDqRun {
  id: number;
  tenantId: number | null;
  ruleId: number;
  datasetId: number;
  status: ReportDqRunStatus;
  triggerType: 'manual' | 'scheduled' | 'dataset_refresh';
  checkedRows: number;
  failedRows: number;
  passRate?: number | null;
  sampleRows: Record<string, unknown>[];
  sampleRowCount: number;
  sampleBytes: number;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  schemaSignature?: string | null;
  requestedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDqScore {
  id: number;
  tenantId: number | null;
  datasetId: number;
  score: number;
  passedRules: number;
  failedRules: number;
  totalRules: number;
  measuredAt: string;
  dimensions: Record<string, number>;
  createdAt: string;
}

export interface ReportDqAnomaly {
  id: number;
  tenantId: number | null;
  datasetId: number;
  ruleId?: number | null;
  runId?: number | null;
  severity: ReportDqSeverity;
  title: string;
  detail?: string | null;
  sample: Record<string, unknown>;
  sampleRowCount?: number;
  sampleBytes?: number;
  status: ReportDqAnomalyStatus;
  acknowledgedAt?: string | null;
  acknowledgedBy?: number | null;
  acknowledgementNote?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportMaterializationSnapshot {
  id: number;
  tenantId: number | null;
  datasetId: number;
  strategy: ReportMaterializationStrategy;
  status: ReportSnapshotStatus;
  revision: number;
  keyField?: string | null;
  watermark?: string | null;
  deltaWindowMinutes?: number | null;
  fileId?: string | null;
  rowCount: number;
  byteSize: number;
  checksum?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  errorMessage?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportQueryQuota {
  id: number;
  tenantId: number | null;
  scope: ReportQuotaScope;
  userId?: number | null;
  maxConcurrent: number;
  dailyQueryLimit: number;
  dailyRowLimit: number;
  dailyByteLimit: number;
  dailyCostLimit: number;
  resetTimezone: string;
  enabled: boolean;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportQueryCostLog {
  id: number;
  tenantId: number | null;
  userId?: number | null;
  datasetId?: number | null;
  datasourceId?: number | null;
  scene: string;
  requestId: string;
  queuedMs: number;
  durationMs: number;
  rowCount: number;
  byteSize: number;
  costUnits: number;
  cacheHit: boolean;
  success: boolean;
  errorCode?: string | null;
  occurredAt: string;
}

export interface ReportQueryCapacity {
  globalLimit: number;
  running: number;
  queueDepth: number;
  datasourceQueues: number;
}

export interface ReportQueryCostStats {
  queries: number;
  rows: number;
  bytes: number;
  costUnits: number;
  avgDurationMs: number;
  failures: number;
  capacity: ReportQueryCapacity;
}

export interface ReportQueryCostTrendPoint {
  bucket: string;
  queries: number;
  rows: number;
  bytes: number;
  costUnits: number;
  avgDurationMs: number;
  queueMs: number;
}

export interface ReportSlaRule {
  id: number;
  tenantId: number | null;
  datasetId: number;
  name: string;
  type: ReportSlaType;
  targetValue: number;
  warningValue?: number | null;
  windowMinutes: number;
  cron?: string | null;
  timezone: string;
  severity: ReportDqSeverity;
  channels: ReportNotifyChannel[];
  recipients?: string | null;
  webhookUrl?: string | null;
  silenceMins: number;
  enabled: boolean;
  lastEvaluatedAt?: string | null;
  lastNotifiedAt?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSlaViolation {
  id: number;
  tenantId: number | null;
  ruleId: number;
  datasetId: number;
  status: ReportSlaViolationStatus;
  observedValue: number;
  targetValue: number;
  windowStartedAt: string;
  windowEndedAt: string;
  detail?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: number | null;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportAssetUsageLog {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  userId?: number | null;
  action: 'view' | 'query' | 'export' | 'embed' | 'share';
  scene?: string | null;
  durationMs?: number | null;
  rowCount: number;
  byteSize: number;
  success: boolean;
  occurredAt: string;
}

export interface ReportDeprecationNotice {
  id: number;
  tenantId: number | null;
  resourceType: ReportResourceType;
  resourceId: number;
  title: string;
  message: string;
  replacementResourceType?: ReportResourceType | null;
  replacementResourceId?: number | null;
  effectiveAt: string;
  expiresAt?: string | null;
  publishedAt?: string | null;
  publishedBy?: number | null;
  processedAt?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportAssetTemplate {
  id: number;
  tenantId: number | null;
  folderId: number | null;
  folderName?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  code: string;
  name: string;
  type: ReportAssetTemplateType;
  description?: string | null;
  content: Record<string, unknown>;
  previewFileId?: string | null;
  version: number;
  usageCount: number;
  status: 'enabled' | 'disabled';
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportAssetUsageTrendPoint {
  bucket: string;
  views: number;
  queries: number;
  exports: number;
  embeds: number;
  shares: number;
  uniqueUsers: number;
}

export interface ReportAssetTemplateApplyResult {
  resourceType: ReportResourceType;
  resourceId: number;
  name: string;
}

export interface ReportChatbiChartSuggestion {
  type: ReportWidgetType;
  title: string;
  categoryField?: string;
  valueFields?: string[];
  options?: Record<string, unknown>;
}

export interface ReportChatbiContextSnapshot {
  datasourceId: number;
  datasourceName: string;
  datasourceType: ReportDatasourceType;
  datasetId?: number | null;
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string }>;
  }>;
  frozenAt: string;
}

export interface ReportChatbiSession {
  id: number;
  tenantId: number | null;
  userId: number;
  title: string;
  datasourceId?: number | null;
  datasetId?: number | null;
  allowedTables: string[];
  contextSnapshot: ReportChatbiContextSnapshot;
  status: ReportChatbiSessionStatus;
  totalTokens: number;
  totalCostUnits: number;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportChatbiMessage {
  id: number;
  tenantId: number | null;
  sessionId: number;
  userId?: number | null;
  role: ReportChatbiMessageRole;
  content: string;
  generatedSql?: string | null;
  chartSuggestion?: ReportChatbiChartSuggestion | null;
  resultSample: Record<string, unknown>[];
  resultRowCount: number;
  resultByteSize: number;
  savedResourceType?: ReportResourceType | null;
  savedResourceId?: number | null;
  savedDatasetId?: number | null;
  savedDashboardId?: number | null;
  promptTokens: number;
  completionTokens: number;
  costUnits: number;
  latencyMs?: number | null;
  modelId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface ReportChatbiSessionDetail {
  session: ReportChatbiSession;
  messages: ReportChatbiMessage[];
}

export interface ReportChatbiQuota {
  aiPromptTokensToday: number;
  aiCompletionTokensToday: number;
  aiRequestsToday: number;
  queryCountToday: number;
  queryRowsToday: number;
  queryBytesToday: number;
  queryCostUnitsToday: number;
}

export interface ReportChatbiSavedResource {
  resourceType: 'dataset' | 'dashboard';
  resourceId: number;
  name: string;
  datasetId?: number | null;
}

export interface ReportFillTemplate {
  id: number;
  tenantId: number | null;
  folderId: number | null;
  folderName?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  code: string;
  name: string;
  description?: string | null;
  formSchema: WorkflowFormSchema;
  publishedSchema?: WorkflowFormSchema | null;
  publishedRevision?: number | null;
  workflowDefinitionId?: number | null;
  workflowDefinitionName?: string | null;
  needReview: boolean;
  generatedDatasetId?: number | null;
  status: ReportFillTemplateStatus;
  revision: number;
  publishedAt?: string | null;
  publishedBy?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportFillRecord {
  id: number;
  tenantId: number | null;
  templateId: number;
  templateName?: string | null;
  submitterId: number;
  submitterName?: string | null;
  status: ReportFillRecordStatus;
  data: Record<string, unknown>;
  templateRevision: number;
  templateSchemaSnapshot: WorkflowFormSchema;
  templateNeedReview: boolean;
  workflowDefinitionIdSnapshot?: number | null;
  submitComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  reviewComment?: string | null;
  workflowInstanceId?: number | null;
  generatedDatasetId?: number | null;
  syncStatus: ReportFillSyncStatus;
  syncTaskId?: number | null;
  syncError?: string | null;
  syncedAt?: string | null;
  revision: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportMobileDashboardPreference {
  dashboardId: number;
  compactMode?: boolean;
  hiddenWidgetIds?: string[];
  widgetOrder?: string[];
  defaultFilterValues?: Record<string, unknown>;
  refreshInterval?: number;
}

export interface ReportCapacityTrendPoint {
  time: string;
  queries: number;
  concurrentPeak: number;
  rows: number;
  bytes: number;
  costUnits: number;
  p95DurationMs: number;
}

export interface ReportQueryGovernanceSummary {
  concurrentRunning: number;
  concurrentLimit: number;
  dailyQueries: number;
  dailyQueryLimit: number;
  dailyRows: number;
  dailyRowLimit: number;
  dailyBytes: number;
  dailyByteLimit: number;
  dailyCostUnits: number;
  dailyCostLimit: number;
  trends: ReportCapacityTrendPoint[];
}

export interface ReportQualitySummary {
  datasetId: number;
  score: number | null;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  openAnomalies: number;
  criticalAnomalies: number;
  lastMeasuredAt?: string | null;
}

export interface ReportAssetUsageSummary {
  resourceType: ReportResourceType;
  resourceId: number;
  views: number;
  queries: number;
  exports: number;
  uniqueUsers: number;
  lastUsedAt?: string | null;
  deprecated: boolean;
  deprecationNotice?: ReportDeprecationNotice | null;
}

export interface ReportAssetCatalogItem {
  resourceType: ReportResourceType;
  resourceId: number;
  tenantId: number | null;
  name: string;
  ownerId: number | null;
  ownerName?: string | null;
  folderId: number | null;
  folderName?: string | null;
  lifecycleStatus?: string | null;
  status?: string | null;
  deprecationEffectiveAt?: string | null;
  updatedAt: string;
}

export interface ReportQueryQuotaUsage {
  tenantId: number | null;
  userId: number | null;
  timezone: string;
  day: string;
  concurrent: number;
  queries: number;
  rows: number;
  bytes: number;
  costUnits: number;
  maxConcurrent: number;
  dailyQueryLimit: number;
  dailyRowLimit: number;
  dailyByteLimit: number;
  dailyCostLimit: number;
}

export interface ReportResourceDetail {
  resource: ReportResourceSummary;
  acls: ReportResourceAcl[];
  pendingApprovals: ReportPublishApproval[];
  usage: ReportAssetUsageSummary;
  deprecationNotices: ReportDeprecationNotice[];
}

export interface ReportDatasetPlatformDetail {
  dataset: ReportDataset;
  metrics: ReportMetric[];
  quality: ReportQualitySummary;
  materializationSnapshots: ReportMaterializationSnapshot[];
  slaRules: ReportSlaRule[];
  usage: ReportAssetUsageSummary;
}

export interface ReportFillRecordDetail extends ReportFillRecord {
  template: ReportFillTemplate;
  workflowStatus?: string | null;
  generatedDataset?: ReportDataset | null;
}
