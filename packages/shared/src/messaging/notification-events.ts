/**
 * 通知事件目录（Notification Event Catalog）。
 *
 * 事件的**唯一定义源是这份代码**，数据库只存管理员改过的稀疏覆盖行。
 * 这样做的直接收益：
 * - `notify('wiki.doc.commentd', …)` 这类事件 key 拼写错误在编译期就暴露；
 * - 事件变量缺传、类型不符同样编译不过，不会等到线上渲染出 `{{docTitle}}` 字面量；
 * - 业务里删掉调用点后事件目录不会残留幽灵条目（DB 驱动的目录必然与代码脱节）。
 *
 * 新增事件 = 在 `NOTIFICATION_EVENTS` 里加一项 + 在业务处调用 `notify()`，无需迁移、无需种子。
 */
import type {
  NotificationChannel,
  NotificationEventGroup,
  NotificationSeverity,
} from './constants';

export interface NotificationEventDef {
  /** 所属分组，决定偏好矩阵中的折叠位置 */
  group: NotificationEventGroup;
  /** 事件中文名，展示在偏好矩阵与策略中心 */
  label: string;
  /** 补充说明，展示为矩阵行的次级文案 */
  description?: string;
  severity: NotificationSeverity;
  /** 收件人未做任何配置时实际生效的渠道 */
  defaultChannels: readonly NotificationChannel[];
  /**
   * 允许收件人自行开关的渠道全集。
   * 省略时等于 `defaultChannels`——未列出的渠道不会出现在矩阵里，也无法被偏好打开，
   * 避免用户给「短信」打上勾却因为该事件根本没有短信模板而永远收不到。
   */
  availableChannels?: readonly NotificationChannel[];
  /** 强制事件：收件人不可关闭（仅限账号安全等必达场景），矩阵中显示为锁定 */
  mandatory?: boolean;
  /** 穿透免打扰时段直接投递 */
  bypassQuietHours?: boolean;
  /** 各渠道模板 code；未配置的渠道回退到事件自带的标题/正文渲染 */
  templates?: Partial<Record<NotificationChannel, string>>;
  /**
   * 频控：同一收件人在窗口内同事件同渠道最多收到 limit 条，超出记 `rate_limited`。
   * 只给评论/提及这类可能风暴化的事件配置；告警类必达事件不要配。
   */
  rateLimit?: { limit: number; windowMinutes: number };
  /** 不在偏好矩阵中展示（如摘要这类由派发层自身触发的元事件） */
  hidden?: boolean;
  /**
   * 变量类型占位。运行期恒为空对象，只用于在编译期把事件 key 与
   * `notify()` 的 `vars` 参数绑定起来。
   */
  vars: Record<string, unknown>;
  /** 默认标题模板，支持 `{{var}}` 占位 */
  title: string;
  /** 默认正文模板，支持 `{{var}}` 占位 */
  content: string;
}

/**
 * 保留字面量类型的注册函数。
 * `const` 类型参数让每个事件的 `vars` 保持精确形状，而不是被拓宽成 `Record<string, unknown>`。
 */
export function defineNotificationEvents<const T extends Record<string, NotificationEventDef>>(defs: T): T {
  return defs;
}

/** 变量占位构造器：`vars: eventVars<{ docId: number }>()` 比 `{} as { docId: number }` 更难写错。 */
export function eventVars<V extends Record<string, unknown>>(): V {
  return {} as V;
}

export const NOTIFICATION_EVENTS = defineNotificationEvents({
  // ─── 知识中心 ───────────────────────────────────────────────────────────────
  'wiki.doc.published': {
    group: 'wiki',
    label: '订阅文档发布新版本',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ docId: number; docTitle: string }>(),
    title: '订阅的知识文档已更新',
    content: '你订阅的文档《{{docTitle}}》发布了新版本，点击知识中心查看。',
  },
  'wiki.doc.commented': {
    group: 'wiki',
    label: '文档收到新评论',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    rateLimit: { limit: 10, windowMinutes: 60 },
    vars: eventVars<{ docId: number; docTitle: string; summary: string }>(),
    title: '知识文档有新评论',
    content: '《{{docTitle}}》收到新评论：{{summary}}',
  },
  'wiki.doc.mentioned': {
    group: 'wiki',
    label: '评论中被 @ 提及',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    rateLimit: { limit: 10, windowMinutes: 60 },
    vars: eventVars<{ docId: number; docTitle: string }>(),
    title: '有人在知识文档中提到了你',
    content: '你在《{{docTitle}}》的评论中被提及，去看看吧。',
  },
  'wiki.doc.reviewed': {
    group: 'wiki',
    label: '文档审核结果',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ docId: number; docTitle: string; resultText: string }>(),
    title: '知识文档审核结果',
    content: '你提交的《{{docTitle}}》{{resultText}}',
  },
  'wiki.governance.maintenance_due': {
    group: 'wiki',
    label: '文档待维护提醒',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ docId: number; docTitle: string }>(),
    title: '知识文档待维护提醒',
    content: '你负责的文档《{{docTitle}}》需要复核更新，请前往知识中心处理。',
  },
  'wiki.governance.review_due': {
    group: 'wiki',
    label: '文档复审到期 / 已过有效期',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ docId: number; docTitle: string; stateText: string }>(),
    title: '知识文档需要处理',
    content: '文档《{{docTitle}}》{{stateText}}，请前往知识中心更新或归档。',
  },

  // ─── 工作流 ─────────────────────────────────────────────────────────────────
  // email / sms 是否真正可用还取决于流程定义里的 notifyChannels 开关（管理员配置层），
  // 因此列入 availableChannels 但不放进 defaultChannels。
  'workflow.task.created': {
    group: 'workflow',
    label: '收到新待办审批',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'sms'],
    bypassQuietHours: true,
    vars: eventVars<{ instanceId: number; taskId: number; title: string; node: string }>(),
    title: '待办审批提醒',
    content: '你有一条新的待办：流程「{{title}}」（节点：{{node}}），请及时处理',
  },
  'workflow.task.cc': {
    group: 'workflow',
    label: '流程抄送给我',
    severity: 'normal',
    defaultChannels: ['inapp'],
    vars: eventVars<{ instanceId: number; taskId: number; title: string; node: string }>(),
    title: '流程抄送通知',
    content: '流程「{{title}}」抄送给你（节点：{{node}}）',
  },
  'workflow.task.urged': {
    group: 'workflow',
    label: '待办被催办',
    severity: 'important',
    defaultChannels: ['inapp'],
    bypassQuietHours: true,
    vars: eventVars<{ instanceId: number; taskId: number; title: string; node: string; extra: string }>(),
    title: '催办提醒',
    content: '流程「{{title}}」（节点：{{node}}）有人催办{{extra}}，请尽快处理',
  },
  'workflow.task.transferred': {
    group: 'workflow',
    label: '待办转交给我',
    severity: 'normal',
    defaultChannels: ['inapp'],
    vars: eventVars<{ instanceId: number; taskId: number; title: string; node: string }>(),
    title: '待办转交提醒',
    content: '流程「{{title}}」（节点：{{node}}）的审批任务已转交给你，请及时处理',
  },
  'workflow.instance.approved': {
    group: 'workflow',
    label: '我发起的流程通过',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'sms'],
    vars: eventVars<{ instanceId: number; title: string; status: string }>(),
    title: '审批通过',
    content: '你发起的流程「{{title}}」已审批通过',
  },
  'workflow.instance.rejected': {
    group: 'workflow',
    label: '我发起的流程被驳回',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'sms'],
    vars: eventVars<{ instanceId: number; title: string; status: string }>(),
    title: '审批被驳回',
    content: '你发起的流程「{{title}}」已被驳回',
  },
  'workflow.instance.withdrawn': {
    group: 'workflow',
    label: '我发起的流程已撤回',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'sms'],
    vars: eventVars<{ instanceId: number; title: string; status: string }>(),
    title: '流程已撤回',
    content: '你发起的流程「{{title}}」已撤回',
  },
  'workflow.instance.returned': {
    group: 'workflow',
    label: '我发起的流程被退回',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'sms'],
    vars: eventVars<{ instanceId: number; title: string; status: string }>(),
    title: '申请被退回',
    content: '你发起的流程「{{title}}」已被退回，请修改后重新提交',
  },

  // ─── 组织与租户 ─────────────────────────────────────────────────────────────
  'identity.tenant.expiring': {
    group: 'identity',
    label: '租户即将到期',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    bypassQuietHours: true,
    vars: eventVars<{ tenantName: string; days: number; expireAt: string }>(),
    title: '租户「{{tenantName}}」将于 {{days}} 天后到期',
    content: '租户「{{tenantName}}」将于 {{expireAt}} 到期（剩余 {{days}} 天），到期后系统将自动停用该租户，请及时续期。',
  },
  'identity.tenant.expired': {
    group: 'identity',
    label: '租户已到期停用',
    severity: 'critical',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    // 直接导致租户下所有人无法登录，关掉它等于让人在毫无预警的情况下失去访问
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ tenantName: string; expireAt: string }>(),
    title: '租户「{{tenantName}}」已到期停用',
    content: '租户「{{tenantName}}」已于 {{expireAt}} 到期，系统已自动停用，该租户用户将无法登录。如需继续使用请联系平台管理员续期。',
  },

  // ─── 运维与告警 ─────────────────────────────────────────────────────────────
  // 告警类事件由管理员在规则上显式指定渠道与接收人，收件人不得自行关闭：
  // 「配了规则却没人收到」正是这套系统最不能出现的失效模式。
  'ops.monitor.alert': {
    group: 'ops',
    label: '系统监控告警',
    severity: 'critical',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'webhook'],
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ ruleName: string; tag: string; message: string }>(),
    title: '[监控{{tag}}] {{ruleName}}',
    content: '{{message}}',
  },
  'ops.monitor.alert_test': {
    group: 'ops',
    label: '监控告警渠道测试',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'webhook'],
    // 试发的目的就是验证渠道配置本身，被收件人偏好挡掉会让「测试通过但没收到」变成误判
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ ruleName: string; message: string }>(),
    title: '[监控告警测试] {{ruleName}}',
    content: '{{message}}',
  },
  'ops.error.alert': {
    group: 'ops',
    label: '前端错误监控告警',
    severity: 'critical',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'webhook'],
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ ruleName: string; detail: string }>(),
    title: '[错误告警] {{ruleName}}',
    content: '{{detail}}',
  },
  'ops.scheduler.job_failed': {
    group: 'ops',
    label: '定时任务执行失败',
    severity: 'critical',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'webhook', 'chat'],
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ jobName: string; errorMessage: string }>(),
    title: '定时任务执行失败',
    content: '任务「{{jobName}}」执行失败：{{errorMessage}}',
  },
  'ops.scheduler.task_alert': {
    group: 'ops',
    label: '系统调度任务告警',
    severity: 'critical',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email', 'webhook', 'chat'],
    mandatory: true,
    bypassQuietHours: true,
    vars: eventVars<{ taskTitle: string; taskName: string; module: string; runId: number; alertMessage: string }>(),
    title: '[系统调度告警] {{taskTitle}}',
    content: '任务「{{taskTitle}}」（{{module}} / {{taskName}}，运行 #{{runId}}）触发告警：{{alertMessage}}',
  },

  // ─── 开放平台 ───────────────────────────────────────────────────────────────
  'open-platform.app.review_requested': {
    group: 'open-platform',
    label: '有应用待审核',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ appName: string }>(),
    title: '开放平台应用待审核',
    content: '开发者应用「{{appName}}」已提交审核。',
  },
  'open-platform.app.reviewed': {
    group: 'open-platform',
    label: '我的应用审核结果',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ appName: string; resultText: string }>(),
    title: '应用审核结果',
    content: '应用「{{appName}}」{{resultText}}',
  },
  'open-platform.webhook.delivery_failed': {
    group: 'open-platform',
    label: 'Webhook 投递失败',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    vars: eventVars<{ subscriptionName: string; detail: string }>(),
    title: 'Webhook 投递失败',
    content: '订阅「{{subscriptionName}}」{{detail}}',
  },
  'open-platform.quota.threshold_exceeded': {
    group: 'open-platform',
    label: 'API 配额告警',
    severity: 'important',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    bypassQuietHours: true,
    vars: eventVars<{ threshold: number; appName: string; dimensionText: string; used: number; quotaLimit: number }>(),
    title: '开放 API 配额已使用 {{threshold}}%',
    content: '应用「{{appName}}」{{dimensionText}}配额已使用 {{used}}/{{quotaLimit}}，请关注剩余额度。',
  },

  // ─── 报表中心 ───────────────────────────────────────────────────────────────
  'report.dashboard.mentioned': {
    group: 'report',
    label: '仪表盘评论中被提及',
    severity: 'normal',
    defaultChannels: ['inapp'],
    availableChannels: ['inapp', 'email'],
    rateLimit: { limit: 10, windowMinutes: 60 },
    vars: eventVars<{ dashboardId: number; dashboardName: string }>(),
    title: '仪表盘评论提及提醒',
    content: '你在仪表盘「{{dashboardName}}」评论中被提及，请前往查看。',
  },

  // ─── 通知中心元事件 ─────────────────────────────────────────────────────────
  // 摘要邮件本身：由摘要聚合任务触发，不出现在偏好矩阵（用户通过摘要模式控制它）。
  'messaging.digest': {
    group: 'messaging',
    label: '通知摘要',
    severity: 'normal',
    defaultChannels: ['email'],
    hidden: true,
    vars: eventVars<{ count: number; periodText: string }>(),
    title: '你有 {{count}} 条未读通知摘要',
    content: '{{periodText}}期间共有 {{count}} 条通知，详见邮件内容。',
  },
});

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS;

/** 事件对应的变量形状；`notify()` 用它约束调用方传参。 */
export type NotificationEventVars<K extends NotificationEventKey> = (typeof NOTIFICATION_EVENTS)[K]['vars'];

export const NOTIFICATION_EVENT_KEYS = Object.keys(NOTIFICATION_EVENTS) as NotificationEventKey[];

export function getNotificationEvent(key: NotificationEventKey): NotificationEventDef {
  return NOTIFICATION_EVENTS[key];
}

export function isNotificationEventKey(key: string): key is NotificationEventKey {
  return Object.hasOwn(NOTIFICATION_EVENTS, key);
}

/**
 * 事件在偏好矩阵中可展示的渠道列。
 * 省略 `availableChannels` 时退回 `defaultChannels`，保证矩阵里不会出现无法送达的勾选项。
 */
export function eventAvailableChannels(def: NotificationEventDef): readonly NotificationChannel[] {
  return def.availableChannels ?? def.defaultChannels;
}
