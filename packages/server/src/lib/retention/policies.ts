import { db } from '../../db';
import { analyticsSettings } from '../../db/schema';
import type { RetentionPolicyDefinition, TenantRetentionDays } from './types';

/** 行为埋点：各租户在「数据分析设置」中自定义的埋点保留天数 */
async function analyticsEventRetention(): Promise<TenantRetentionDays> {
  const rows = await db.select({
    tenantId: analyticsSettings.tenantId,
    days: analyticsSettings.retentionDays,
  }).from(analyticsSettings);
  return new Map(rows.map((row) => [row.tenantId, row.days]));
}

/** 前端错误：各租户在「数据分析设置」中自定义的错误保留天数 */
async function analyticsErrorRetention(): Promise<TenantRetentionDays> {
  const rows = await db.select({
    tenantId: analyticsSettings.tenantId,
    days: analyticsSettings.errorRetentionDays,
  }).from(analyticsSettings);
  return new Map(rows.map((row) => [row.tenantId, row.days]));
}

/**
 * 全库数据保留策略声明（SSOT）。
 *
 * 新增 append-only 表时必须在此登记，`retention-coverage.test.ts` 会校验覆盖率。
 * 声明的 `defaultDays` 仅在策略首次注册时写入 `retention_policies` 表；
 * 之后管理员在后台调整的值不会被重启覆盖。
 */
export const RETENTION_POLICIES: readonly RetentionPolicyDefinition[] = [
  // ── 系统管理 ───────────────────────────────────────────────────────────────
  {
    key: 'operation_logs',
    title: '操作日志',
    module: '系统管理',
    tableName: 'operation_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '后台写操作的审计留痕，含变更前后快照与响应体，单行体积较大。',
  },
  {
    key: 'login_logs',
    title: '登录日志',
    module: '系统管理',
    tableName: 'login_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '管理端登录 / 登出记录。',
  },
  {
    key: 'ip_access_logs',
    title: 'IP 拦截日志',
    module: '系统管理',
    tableName: 'ip_access_logs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: 'IP 黑白名单拦截流水。',
  },
  {
    key: 'login_risk_events',
    title: '登录风险事件',
    module: '系统管理',
    tableName: 'login_risk_events',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '异地 / 异常设备等登录风险识别记录。',
  },
  {
    key: 'license_events',
    title: 'License 事件日志',
    module: '系统管理',
    tableName: 'license_events',
    timeColumn: 'created_at',
    defaultDays: 365,
    description: 'License 激活 / 校验 / 状态迁移 / 功能拒绝等授权审计事件，保留一年便于商务追溯。',
  },
  {
    key: 'identity_provider_sync_logs',
    title: '身份源同步日志',
    module: '系统管理',
    tableName: 'identity_provider_sync_logs',
    timeColumn: 'started_at',
    defaultDays: 90,
    description: '企业身份源（OIDC / SAML / LDAP）用户同步运行记录。',
  },
  {
    key: 'directory_sync_runs',
    title: '通讯录同步记录',
    module: '通讯录同步',
    tableName: 'directory_sync_runs',
    timeColumn: 'started_at',
    defaultDays: 90,
    description: '通讯录同步的运行记录；差异明细（directory_sync_run_items）随记录级联删除。',
  },
  {
    key: 'maintenance_logs',
    title: '维护记录',
    module: '系统管理',
    tableName: 'maintenance_logs',
    timeColumn: 'created_at',
    defaultDays: 365,
    description: '维护模式开启至关闭的时段记录。',
  },
  {
    key: 'db_admin_query_history',
    title: '数据库查询历史',
    module: '系统管理',
    tableName: 'db_admin_query_history',
    timeColumn: 'executed_at',
    defaultDays: 90,
    description: '数据库管理台的 SQL 执行历史。',
  },

  // ── 系统调度 ───────────────────────────────────────────────────────────────
  {
    key: 'system_scheduler_runs',
    title: '系统调度运行日志',
    module: '系统调度',
    tableName: 'system_scheduler_runs',
    timeColumn: 'started_at',
    defaultDays: 30,
    mode: 'ageAndCap',
    capColumn: 'task_name',
    capLimit: 1000,
    description: '系统级周期任务的运行记录；按时间裁剪后每个任务再保留最近 1000 条。',
  },
  {
    key: 'cron_job_logs',
    title: '定时任务执行日志',
    module: '系统调度',
    tableName: 'cron_job_logs',
    timeColumn: 'started_at',
    defaultDays: 30,
    mode: 'ageAndCap',
    capColumn: 'job_id',
    capLimit: 500,
    description: '用户自建定时任务的执行记录。',
  },
  {
    key: 'system_scheduler_nodes',
    title: '调度节点注册记录',
    module: '系统调度',
    tableName: 'system_scheduler_nodes',
    timeColumn: 'last_heartbeat_at',
    defaultDays: 7,
    description: '调度/作业 Worker 节点心跳注册表；节点 ID 含进程号，每次重启新增一行，清理心跳停止超过保留期的历史节点。',
  },

  // ── 监控告警 ───────────────────────────────────────────────────────────────
  {
    key: 'system_metric_samples',
    title: '系统指标采样',
    module: '监控告警',
    tableName: 'system_metric_samples',
    timeColumn: 'sampled_at',
    defaultDays: 30,
    description: 'CPU / 内存 / 磁盘等指标采样点，驱动监控趋势图。',
  },
  {
    key: 'monitor_alert_events',
    title: '监控告警事件',
    module: '监控告警',
    tableName: 'monitor_alert_events',
    timeColumn: 'triggered_at',
    defaultDays: 180,
    description: '监控告警的触发与恢复事件。',
  },

  // ── 通知中心 ───────────────────────────────────────────────────────────────
  {
    key: 'email_send_logs',
    title: '邮件发送日志',
    module: '通知中心',
    tableName: 'email_send_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '邮件发送流水，含正文与失败原因。',
  },
  {
    key: 'sms_send_logs',
    title: '短信发送日志',
    module: '通知中心',
    tableName: 'sms_send_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '短信发送流水，含运营商回执状态。',
  },
  {
    key: 'in_app_messages',
    title: '站内信',
    module: '通知中心',
    tableName: 'in_app_messages',
    timeColumn: 'created_at',
    defaultDays: 365,
    description: '站内信收件记录。',
  },

  // ── 数据分析 ───────────────────────────────────────────────────────────────
  {
    key: 'user_events',
    title: '行为埋点事件',
    module: '数据分析',
    tableName: 'user_events',
    timeColumn: 'created_at',
    defaultDays: 180,
    perTenant: analyticsEventRetention,
    description: '原始埋点事件，增长最快的表之一；各租户可在数据分析设置中单独指定保留天数。',
  },
  {
    key: 'analytics_sessions',
    title: '行为会话',
    module: '数据分析',
    tableName: 'analytics_sessions',
    timeColumn: 'started_at',
    defaultDays: 180,
    perTenant: analyticsEventRetention,
    description: '按会话聚合的访问记录，与埋点事件同保留口径。',
  },
  {
    key: 'error_events',
    title: '前端错误事件',
    module: '数据分析',
    tableName: 'error_events',
    timeColumn: 'created_at',
    defaultDays: 90,
    perTenant: analyticsErrorRetention,
    onDeleted: async () => {
      const { purgeOrphanErrorGroups } = await import('../../services/analytics/analytics-rollup.service');
      await purgeOrphanErrorGroups();
    },
    description: '前端 JS 异常上报明细；各租户可单独指定错误保留天数。清理后同步回收无引用的错误分组。',
  },
  {
    key: 'analytics_event_quality_daily',
    title: '埋点质量日聚合',
    module: '数据分析',
    tableName: 'analytics_event_quality_daily',
    timeColumn: 'stat_date',
    defaultDays: 180,
    description: '随事件采集持续写入的派生聚合，跟随埋点保留口径。',
  },
  {
    key: 'error_alert_logs',
    title: '错误告警日志',
    module: '数据分析',
    tableName: 'error_alert_logs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '前端错误告警规则的触发记录。',
  },

  // ── 支付中心 ───────────────────────────────────────────────────────────────
  {
    key: 'payment_notify_logs',
    title: '支付回调日志',
    module: '支付中心',
    tableName: 'payment_notify_logs',
    timeColumn: 'created_at',
    defaultDays: 365,
    description: '渠道异步回调原始报文，用于对账与纠纷举证。',
  },
  {
    key: 'payment_events',
    title: '支付事件 outbox',
    module: '支付中心',
    tableName: 'payment_events',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '支付领域事件投递记录。',
  },
  {
    key: 'payment_webhook_deliveries',
    title: '支付 Webhook 投递',
    module: '支付中心',
    tableName: 'payment_webhook_deliveries',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '向业务方推送支付事件的投递结果。',
  },
  {
    key: 'payment_risk_hits',
    title: '支付风控命中',
    module: '支付中心',
    tableName: 'payment_risk_hits',
    timeColumn: 'created_at',
    defaultDays: 365,
    description: '支付风控规则命中流水。',
  },

  // ── 会员中心 ───────────────────────────────────────────────────────────────
  {
    key: 'member_login_logs',
    title: '会员登录日志',
    module: '会员中心',
    tableName: 'member_login_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: 'C 端会员登录记录。',
  },

  // ── 开放平台 ───────────────────────────────────────────────────────────────
  {
    key: 'open_api_call_logs',
    title: '开放 API 调用日志',
    module: '开放平台',
    tableName: 'open_api_call_logs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '开放网关调用明细；按日聚合统计由独立任务生成，不受本策略影响。',
  },
  {
    key: 'app_webhook_deliveries',
    title: '开放应用 Webhook 投递',
    module: '开放平台',
    tableName: 'app_webhook_deliveries',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '开放应用 Webhook 的投递与重试记录。',
  },

  // ── 工作流 ─────────────────────────────────────────────────────────────────
  {
    key: 'workflow_engine_health_snapshots',
    title: '流程引擎健康快照',
    module: '工作流',
    tableName: 'workflow_engine_health_snapshots',
    timeColumn: 'created_at',
    defaultDays: 7,
    description: '每 5 分钟采集的引擎健康快照，驱动健康趋势图。',
  },
  {
    key: 'workflow_compensation_logs',
    title: '流程补偿日志',
    module: '工作流',
    tableName: 'workflow_compensation_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '流程节点补偿动作的执行记录。',
  },
  {
    key: 'workflow_automation_runs',
    title: '流程自动化执行记录',
    module: '工作流',
    tableName: 'workflow_automation_runs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '自动化规则动作（站内信 / Webhook / 发起流程 / 回写字段）的执行留痕。',
  },

  // ── 规则中心 ───────────────────────────────────────────────────────────────
  {
    key: 'rule_decision_executions',
    title: '决策执行记录',
    module: '规则中心',
    tableName: 'rule_decision_executions',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '决策表 / 决策流的执行流水。',
  },

  // ── 报表中心 ───────────────────────────────────────────────────────────────
  {
    key: 'report_dataset_execution_logs',
    title: '数据集执行日志',
    module: '报表中心',
    tableName: 'report_dataset_execution_logs',
    timeColumn: 'executed_at',
    defaultDays: 90,
    description: '数据集取数执行记录。',
  },
  {
    key: 'report_query_cost_logs',
    title: '查询成本日志',
    module: '报表中心',
    tableName: 'report_query_cost_logs',
    timeColumn: 'occurred_at',
    defaultDays: 90,
    description: '报表查询的耗时与扫描量统计。',
  },
  {
    key: 'report_share_access_logs',
    title: '报表分享访问日志',
    module: '报表中心',
    tableName: 'report_share_access_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '公开分享链接的访问记录。',
  },
  {
    key: 'report_dq_runs',
    title: '数据质量运行记录',
    module: '报表中心',
    tableName: 'report_dq_runs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '数据质量规则的巡检运行结果。',
  },
  {
    key: 'report_delivery_runs',
    title: '报表分发运行记录',
    module: '报表中心',
    tableName: 'report_delivery_runs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '报表订阅推送的分发结果。',
  },
  {
    key: 'report_asset_usage_logs',
    title: '报表资产使用日志',
    module: '报表中心',
    tableName: 'report_asset_usage_logs',
    timeColumn: 'occurred_at',
    defaultDays: 180,
    description: '报表资产的引用与访问统计。',
  },

  // ── CMS 内容管理 ───────────────────────────────────────────────────────────
  {
    key: 'cms_visit_logs',
    title: 'CMS 访问日志',
    module: 'CMS内容管理',
    tableName: 'cms_visit_logs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '前台页面访问流水，驱动内容热度统计。',
  },
  {
    key: 'cms_search_logs',
    title: 'CMS 搜索日志',
    module: 'CMS内容管理',
    tableName: 'cms_search_logs',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '站内搜索关键词流水。',
  },
  {
    key: 'cms_ad_events',
    title: 'CMS 广告事件',
    module: 'CMS内容管理',
    tableName: 'cms_ad_events',
    timeColumn: 'occurred_at',
    defaultDays: 180,
    description: '广告曝光与点击明细。',
  },
  {
    key: 'cms_content_op_logs',
    title: 'CMS 内容操作日志',
    module: 'CMS内容管理',
    tableName: 'cms_content_op_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '内容的编辑 / 审核 / 发布操作留痕。',
  },
  {
    key: 'cms_push_logs',
    title: 'CMS 推送日志',
    module: 'CMS内容管理',
    tableName: 'cms_push_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '向搜索引擎推送 URL 的结果记录。',
  },
  {
    key: 'cms_member_view_history',
    title: 'CMS 会员浏览历史',
    module: 'CMS内容管理',
    tableName: 'cms_member_view_history',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '会员在前台的内容浏览足迹。',
  },

  // ── 公众号 ─────────────────────────────────────────────────────────────────
  {
    key: 'mp_template_send_logs',
    title: '模板消息发送日志',
    module: '公众号',
    tableName: 'mp_template_send_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '公众号模板消息发送流水。',
  },
  {
    key: 'mp_kf_session_events',
    title: '客服会话事件',
    module: '公众号',
    tableName: 'mp_kf_session_events',
    timeColumn: 'created_at',
    defaultDays: 90,
    description: '公众号客服会话的接入 / 转接 / 关闭事件。',
  },

  // ── 知识中心 ───────────────────────────────────────────────────────────────
  {
    key: 'wiki_search_logs',
    title: '知识检索日志',
    module: '知识中心',
    tableName: 'wiki_search_logs',
    timeColumn: 'created_at',
    defaultDays: 180,
    description: '知识中心搜索关键词与点击流水，供无结果关键词分析与运营统计。',
  },
];

export function findPolicy(key: string): RetentionPolicyDefinition | undefined {
  return RETENTION_POLICIES.find((policy) => policy.key === key);
}
