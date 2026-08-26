import type { AsyncTask, AsyncTaskItem } from '../tasks/types';
import type { CmsResourceOwnerType } from './constants';

// ─── CMS 内容管理 ─────────────────────────────────────────────────────────────
export type CmsStaticMode = 'dynamic' | 'hybrid' | 'static';

/** 栏目静态化模式：inherit=跟随站点，其余覆盖站点设置 */
export type CmsChannelStaticMode = 'inherit' | CmsStaticMode;

/** 详情页静态产物目录归档策略（栏目路径后追加一级目录；内容 staticPath 优先） */
export type CmsChannelDetailPathRule = 'none' | 'year' | 'month' | 'date' | 'dateStr' | 'idHash';

/** 模型字段选项来源 */
export type CmsFieldOptionSource = 'manual' | 'dict';

/** 内容标题样式（列表页 / 详情页标题展示） */
export interface CmsTitleStyle {
  bold?: boolean;
  /** 十六进制色值（#rrggbb）；空/缺省 = 主题默认色 */
  color?: string | null;
}

/** 内容附件（正文之外的可下载文件） */
export interface CmsContentAttachment {
  name: string;
  url: string;
  /** 字节数（0 = 未知） */
  size: number;
  /** 扩展名（小写，不含点） */
  ext: string;
  sort: number;
}

/** 站点内容策略（存 cms_sites.settings，缺省值见 CMS_SITE_OPS_DEFAULTS） */
export interface CmsSiteOpsSettings {
  publishedContentEditable: boolean;
  recycleKeepDays: number;
  maxPageOnContentPublish: number;
  autoReplaceSensitiveWords: boolean;
  autoReplaceErrorProneWords: boolean;
  autoCoverFromBody: boolean;
  /** 是否允许开放 API 直接发布（默认关闭，外部写入先落草稿走审核） */
  openApiPublishEnabled: boolean;
}

/** 开放应用的 CMS 站点授权（Headless 写入的 fail-closed 边界） */
export interface CmsOpenAppGrant {
  id: number;
  clientId: string;
  appName: string | null;
  siteId: number;
  siteName: string | null;
  /** 允许写入的栏目；空数组 = 该站点全部栏目 */
  channelIds: number[];
  /** 允许直接发布（还需应用持有 cms:publish 且站点开启开关） */
  canPublish: boolean;
  status: 'enabled' | 'disabled';
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CmsChannelType = 'list' | 'page' | 'link';

export type CmsContentStatus = 'draft' | 'pending' | 'published' | 'offline' | 'rejected';

/** 内容形态：article=图文 album=图集 media=音视频 link=外链 */
export type CmsContentType = 'article' | 'album' | 'media' | 'link';

/** 图集单图 */
export interface CmsAlbumImage {
  url: string;
  /** 缩略图（上传管线生成；空 = 用原图） */
  thumb?: string | null;
  caption?: string | null;
}

/** 内容形态结构化数据（album/media 使用，article/link 为空对象） */
export interface CmsContentMediaData {
  /** album：图片列表 */
  images?: CmsAlbumImage[];
  /** media：音频/视频 */
  mediaType?: 'video' | 'audio';
  mediaUrl?: string;
  poster?: string;
  /** 展示用时长文本（如 03:45） */
  duration?: string;
}

export type CmsFieldType = 'text' | 'textarea' | 'richtext' | 'number' | 'date' | 'datetime' | 'image' | 'file' | 'select' | 'radio' | 'checkbox' | 'switch';

export type CmsSiteInheritableField =
  | 'seoTitle'
  | 'seoKeywords'
  | 'seoDescription'
  | 'staticMode'
  | 'reviewMode'
  | 'webhook'
  | 'cdn'
  | 'theme'
  | 'themeConfig'
  | 'templates';

export interface CmsSiteInheritanceFlags {
  seoTitle: boolean;
  seoKeywords: boolean;
  seoDescription: boolean;
  staticMode: boolean;
  reviewMode: boolean;
  webhook: boolean;
  cdn: boolean;
  theme: boolean;
  themeConfig: boolean;
  templates: boolean;
}

export interface CmsSiteInheritanceSource {
  kind: 'own' | 'inherited';
  /** 无权查看来源站点时不返回其 id/name，避免层级侧信道泄露。 */
  siteId: number | null;
  siteName: string | null;
}

export interface CmsSiteEffectiveConfig {
  siteId: number;
  chain: Array<{ id: number; name: string; code: string; depth: number }>;
  inheritance: CmsSiteInheritanceFlags;
  resolved: {
    title: string | null;
    keywords: string | null;
    description: string | null;
    staticMode: CmsStaticMode;
    auditMode: 'simple' | 'workflow';
    auditWorkflowDefinitionId: number | null;
    webhookUrl: string | null;
    /** 仅为 CMS_SECRET_MASK 或 null，绝不包含明文。 */
    webhookSecret: string | null;
    cdnPurgeUrl: string | null;
    /** 仅为 CMS_SECRET_MASK 或 null，绝不包含明文。 */
    cdnPurgeToken: string | null;
    theme: string;
    themeSourceSiteId: number | null;
    themeConfig: Record<string, unknown>;
    defaultTemplates: CmsSiteTemplateDefaults;
  };
  sources: Record<CmsSiteInheritableField, CmsSiteInheritanceSource>;
}

export interface CmsSite {
  id: number;
  parentId: number | null;
  parentName?: string | null;
  depth?: number;
  hasChildren?: boolean;
  name: string;
  code: string;
  domain: string | null;
  aliasDomains: string[];
  isDefault: boolean;
  title: string | null;
  keywords: string | null;
  description: string | null;
  logo: string | null;
  favicon: string | null;
  icp: string | null;
  copyright: string | null;
  theme: string;
  effectiveTheme?: string;
  themeRevision: number;
  templateRefsRevision: number;
  staticMode: CmsStaticMode;
  effectiveStaticMode?: CmsStaticMode;
  robots: string | null;
  /** 站点级扩展模型（对标 XModel 站点/栏目/内容三级绑定） */
  modelId: number | null;
  /** 站点扩展模型名称（JOIN 后附加） */
  modelName?: string | null;
  /** 站点扩展模型字段值（key = cms_model_fields.name） */
  extend: Record<string, unknown>;
  settings: Record<string, unknown>;
  status: 'enabled' | 'disabled';
  sort: number;
  remark: string | null;
  inheritance?: CmsSiteInheritanceFlags;
  children?: CmsSite[];
  createdAt: string;
  updatedAt: string;
}

/** 站点级默认模板配置（存于 sites.settings.defaultTemplates） */
export interface CmsSiteTemplateDefaults {
  /** 栏目列表页默认模板（空 = 主题默认） */
  list?: string | null;
  /** 内容详情页默认模板（空 = 主题默认） */
  detail?: string | null;
  /** 按内容模型细分的详情模板（key = 模型 code，优先于 detail） */
  detailByModel?: Record<string, string | null>;
}

/** 主题可选模板项（后台模板下拉） */
export interface CmsThemeTemplateOption {
  name: string;
  label: string;
  source?: 'own' | 'inherited' | 'global' | 'builtin';
  sourceSiteId?: number | null;
}

/** 主题可选模板清单（不含主题默认模板本身） */
export interface CmsThemeTemplateManifest {
  list: CmsThemeTemplateOption[];
  detail: CmsThemeTemplateOption[];
}

/** 失效模板引用（配置里写了、但目标主题中不存在的模板名） */
export interface CmsInvalidTemplateRef {
  /** 引用位置层级：site=站点默认模板 channel=栏目配置 content=内容覆盖 */
  source: 'site' | 'channel' | 'content';
  kind: 'list' | 'detail';
  /** 失效的模板名 */
  template: string;
  /** 人类可读位置描述（如「站点默认模板[pc]列表」「列表模板」） */
  location: string;
  channelId?: number;
  channelName?: string;
  /** source=content 时聚合的内容条数 */
  count?: number;
}

/** 站点模板健康检查结果（GET /cms/sites/{id}/template-health） */
export interface CmsTemplateHealth {
  /** 被检查的主题（默认站点当前主题，可用 ?theme= 预检目标主题） */
  theme: string;
  /** 主题是否为内置可信主题 */
  themeRegistered: boolean;
  invalidRefs: CmsInvalidTemplateRef[];
}

/** 主题参数字段类型（后台主题参数面板动态表单） */
export type CmsThemeSettingFieldType = 'text' | 'textarea' | 'color' | 'number' | 'switch' | 'select' | 'image';

/** 主题参数字段声明（内置主题 settingsSchema，值存 cms_sites.settings.themeConfig[name]） */
export interface CmsThemeSettingField {
  /** settings.themeConfig 的 key（小写字母开头驼峰） */
  name: string;
  label: string;
  fieldType: CmsThemeSettingFieldType;
  /** 缺省值（站点未配置时渲染用；switch 建议显式声明） */
  defaultValue?: string | number | boolean;
  placeholder?: string;
  /** 表单辅助说明 */
  description?: string;
  /** select 的选项 */
  options?: { label: string; value: string }[];
  /** 分组标题（同组字段渲染在同一 Form.Section 下；空 = 默认分组） */
  group?: string;
}

export type CmsPublishTargetType =
  | 'content'
  | 'contents'
  | 'channel'
  | 'site'
  | 'theme'
  | 'page';

export type CmsPublishArtifactStatus = 'generated' | 'deleted' | 'failed';

export interface CmsPublishArtifact {
  id: number;
  taskId: number;
  siteId: number;
  targetType: CmsPublishTargetType;
  contentId: number | null;
  channelId: number | null;
  pageId: number | null;
  themeCode: string | null;
  path: string;
  url: string | null;
  checksum: string | null;
  size: number | null;
  status: CmsPublishArtifactStatus;
  error: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPublishingTask extends AsyncTask {
  siteId: number | null;
  siteName: string | null;
  siteIds: number[];
  siteNames: string[];
  targetType: CmsPublishTargetType;
  artifactCount: number;
  failedArtifactCount: number;
}

export interface CmsPublishingDetail {
  task: CmsPublishingTask;
  items: AsyncTaskItem[];
  artifacts: CmsPublishArtifact[];
}

// ─── CMS Stage 5：站群内容分发 ────────────────────────────────────────────────
export type CmsDistributionMode = 'copy' | 'mapping' | 'scheduled';

export type CmsDistributionConflictStrategy = 'skip' | 'overwrite' | 'create-new';

export type CmsDistributionRunOutcome = 'success' | 'skipped' | 'conflict' | 'failed';

export interface CmsDistributionFilters {
  /** Stage 5 仅允许 published；保留数组形状供后续安全扩展。 */
  statuses: Array<'published'>;
  contentTypes: CmsContentType[];
  keyword: string | null;
  publishedFrom: string | null;
  publishedTo: string | null;
}

export interface CmsDistributionRule {
  id: number;
  name: string;
  sourceSiteId: number;
  sourceSiteName: string;
  sourceChannelId: number | null;
  sourceChannelName: string | null;
  targetSiteId: number;
  targetSiteName: string;
  targetChannelId: number;
  targetChannelName: string;
  mode: CmsDistributionMode;
  conflictStrategy: CmsDistributionConflictStrategy;
  filters: CmsDistributionFilters;
  scheduleCron: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  status: 'enabled' | 'disabled';
  revision: number;
  remark: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsDistributionRun extends AsyncTask {
  ruleId: number;
  ruleName: string | null;
  sourceSiteId: number;
  sourceSiteName: string | null;
  targetSiteId: number;
  targetSiteName: string | null;
  trigger: 'manual' | 'scheduled' | 'mapping-update';
  succeeded: number;
  skipped: number;
  conflicts: number;
}

export interface CmsDistributionRunDetail {
  run: CmsDistributionRun;
  items: AsyncTaskItem[];
}

export interface CmsPublishSubmitInput {
  siteId: number;
  targetType: CmsPublishTargetType;
  contentIds?: number[];
  channelId?: number;
  pageId?: number;
  pageSlug?: string;
  pageRemovePath?: string;
  pageIsHome?: boolean;
  pageRemoved?: boolean;
  themeCode?: string;
  reason?: string;
  /** 生命周期/引用 fence，仅由可信服务端写入 task payload。 */
  expectedThemeRevision?: number;
  expectedTemplateRefsRevision?: number;
  contentSnapshots?: CmsContentPublishSnapshot[];
  deletePaths?: string[];
}

export interface CmsContentPublishSnapshot {
  contentId: number;
  siteId: number;
  contentVersion: number;
  channelId: number;
  channelPath: string;
  slug: string;
  bodyPages: number;
  build: boolean;
  purged?: boolean;
  /** 本内容对应的全部静态产物路径（含正文分页） */
  paths: string[];
  refreshChannelIds: number[];
}

export interface CmsModelField {
  id: number;
  modelId: number;
  name: string;
  label: string;
  fieldType: CmsFieldType;
  required: boolean;
  searchable: boolean;
  showInList: boolean;
  /** 是否在前台详情页「模型字段表」中展示 */
  showInDetail: boolean;
  /** 详情展示分组标题（如「文件信息」）；空 = 默认分组 */
  detailGroup: string | null;
  /** 详情展示排序（组内） */
  detailSort: number;
  placeholder: string | null;
  defaultValue: string | null;
  /** 选项来源：manual=下方 options 手工维护；dict=引用 dictCode 指向的系统字典 */
  optionSource: CmsFieldOptionSource;
  /** optionSource=dict 时引用的字典编码 */
  dictCode: string | null;
  /** 手工维护的原始选项（optionSource=manual 时有效） */
  options: { label: string; value: string }[] | null;
  /**
   * 解析后的最终选项：manual 直接取 options，dict 取字典项。
   * 表单渲染一律消费本字段，避免每处自行判断来源。
   */
  resolvedOptions?: { label: string; value: string }[];
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsModel {
  id: number;
  /** 归属站点：null = 平台共享（全部站点可用）；非空 = 该站点专属 */
  ownerSiteId: number | null;
  /** 归属站点名称（列表展示；平台共享为 null） */
  ownerSiteName: string | null;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  status: 'enabled' | 'disabled';
  sort: number;
  fields?: CmsModelField[];
  createdAt: string;
  updatedAt: string;
}

/** 模型引用统计（删除阻断明细与"使用中"列消费） */
export interface CmsModelRefs {
  channels: { id: number; siteId: number; siteName: string; name: string }[];
  contentCount: number;
  siteExtendCount: number;
}

export interface CmsChannel {
  id: number;
  siteId: number;
  parentId: number;
  modelId: number | null;
  /** 模型名称（JOIN 后附加） */
  modelName?: string | null;
  name: string;
  /** 栏目标识（站内唯一）：模板 / 区块 / 内链 / 开放 API 的稳定引用，移动栏目与改 slug 都不影响 */
  code: string;
  slug: string;
  path: string;
  type: CmsChannelType;
  linkUrl: string | null;
  listTemplate: string | null;
  detailTemplate: string | null;
  /** 栏目静态化模式（inherit = 跟随站点） */
  staticMode: CmsChannelStaticMode;
  /** 详情页静态产物目录归档策略（内容 staticPath 优先级更高） */
  detailPathRule: CmsChannelDetailPathRule;
  pageSize: number;
  pageContent: string | null;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  image: string | null;
  visible: boolean;
  status: 'enabled' | 'disabled';
  sort: number;
  settings: Record<string, unknown>;
  children?: CmsChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface CmsContent {
  id: number;
  siteId: number;
  channelId: number;
  /** 栏目名称（JOIN 后附加） */
  channelName?: string | null;
  modelId: number | null;
  /** 内容形态（创建后不可变更） */
  contentType: CmsContentType;
  /** 形态结构化数据（album/media 使用） */
  mediaData: CmsContentMediaData;
  title: string;
  /** 标题样式（加粗 / 颜色；空对象 = 主题默认） */
  titleStyle: CmsTitleStyle;
  /** 副标题 */
  subTitle: string | null;
  /** 短标题（列表窄位展示） */
  shortTitle: string | null;
  slug: string | null;
  summary: string | null;
  coverImage: string | null;
  /** 封面缩略图（由封面素材派生，非入参；素材被替换后自动跟随） */
  coverThumb: string | null;
  author: string | null;
  /** 责任编辑 */
  editor: string | null;
  source: string | null;
  /** 来源链接 */
  sourceUrl: string | null;
  /** 原创标记 */
  isOriginal: boolean;
  body: string | null;
  /** 正文附件列表（前台详情页可下载） */
  attachments: CmsContentAttachment[];
  extend: Record<string, unknown>;
  externalLink: string | null;
  /** 详情模板覆盖（主题变体模板名；null = 跟随栏目/站点默认） */
  detailTemplate: string | null;
  /** 自定义静态化相对路径（空 = 按 slug/id 生成） */
  staticPath: string | null;
  isTop: boolean;
  /** 置顶权重（数值越大越靠前，isTop=true 时生效） */
  topWeight: number;
  /** 置顶到期时间（到期自动取消置顶；空 = 永久置顶） */
  topExpireAt: string | null;
  isRecommend: boolean;
  isHot: boolean;
  /** 内容属性自动标记（保存时按正文/形态数据/封面自动检测） */
  hasImage?: boolean;
  hasVideo?: boolean;
  hasAttachment?: boolean;
  status: CmsContentStatus;
  rejectReason: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  /** 过期自动下线时间（空 = 永不过期） */
  expireAt: string | null;
  viewCount: number;
  /** 会员点赞数（冗余计数） */
  likeCount: number;
  /** 会员收藏数（冗余计数） */
  favoriteCount: number;
  /** 乐观锁版本号（更新时回传 expectedVersion） */
  version: number;
  sort: number;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  socialImageAlt: string | null;
  twitterCreator: string | null;
  tagIds?: number[];
  tags?: CmsTag[];
  /** 副栏目 id 列表（一文多栏目） */
  extraChannelIds?: number[];
  /** 相关文章 id 列表（手动关联） */
  relatedIds?: number[];
  /** 会员投稿：非空表示由前台会员提交 */
  memberId?: number | null;
  /** 归档时间（非空表示已归档：前台详情保留，不参与列表聚合） */
  archivedAt: string | null;
  /** 映射来源内容 id（非空表示本内容为映射，正文/扩展字段共享来源内容） */
  mappingSourceId: number | null;
  /** 映射来源内容标题（JOIN 后附加） */
  mappingSourceTitle?: string | null;
  /** 受治理分发规则；空表示非规则物化内容。 */
  distributionRuleId: number | null;
  /** 分发来源内容（copy/mapping 均记录，用于有限幂等与冲突处理）。 */
  distributionSourceId: number | null;
  /** 最近同步的来源内容 version。 */
  distributionSourceVersion: number | null;
  /** 持久化管理员合规锁（非 Redis 编辑软锁） */
  lockedAt: string | null;
  lockedBy: number | null;
  lockedByName?: string | null;
  lockReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** CMS 内容操作日志（内容级时间线） */
export interface CmsContentOpLog {
  id: number;
  contentId: number;
  action: string;
  /** 动作显示名 */
  actionLabel: string;
  detail: string | null;
  operatorId: number | null;
  operatorName: string;
  createdAt: string;
}

export interface CmsContentLockState {
  lockedAt: string;
  lockedBy: number | null;
  lockReason: string | null;
}

/** CMS 易错词（编辑辅助：错误词 → 正确词） */
export interface CmsErrorProneWord {
  id: number;
  word: string;
  correction: string;
  status: 'enabled' | 'disabled';
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 内容文本检查命中结果（敏感词 + 易错词） */
export interface CmsTextCheckResult {
  sensitive: { word: string; replaceWith: string | null; count: number }[];
  errorProne: { word: string; correction: string; count: number }[];
}

// ─── P3 会员互动 / 问卷 ────────────────────────────────────────────────────────

/** 会员对某内容的互动状态（前台详情页交互条用） */
export interface CmsInteractionState {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
  favoriteCount: number;
}

/** 会员收藏 / 浏览历史条目（会员中心列表） */
export interface CmsMemberContentItem {
  contentId: number;
  title: string;
  /** 前台详情 URL（站内路径） */
  url: string | null;
  coverThumb: string | null;
  contentType: CmsContentType;
  /** 浏览历史：累计次数 */
  viewCount?: number;
  createdAt: string;
  /** 浏览历史：最近浏览时间 */
  updatedAt?: string;
}

export type CmsInteractionKind = 'survey' | 'poll';

export type CmsInteractionStatus = 'draft' | 'published' | 'closed';

export type CmsInteractionQuestionType =
  | 'single' | 'multiple' | 'text' | 'rating' | 'nps' | 'matrix' | 'date' | 'number';

export type CmsInteractionConditionOp = 'any' | 'none';

export type CmsInteractionParticipantScope = 'anonymous' | 'member';

export type CmsInteractionRepeatPolicy = 'once_per_member' | 'once_per_ip' | 'multiple';

export type CmsInteractionResultVisibility = 'always' | 'after_submit' | 'after_close' | 'hidden';

export type CmsInteractionCaptchaPolicy = 'inherit' | 'none' | 'math' | 'turnstile';

export interface CmsInteractionOption {
  id: string;
  label: string;
  value: string;
}

/** 条件显示：依赖同一问卷中排在前面的某道选择题 */
export interface CmsInteractionVisibleWhen {
  /** 依赖题目的 0 基序号，必须小于当前题目序号 */
  questionIndex: number;
  op: CmsInteractionConditionOp;
  /** 触发的选项 value 列表 */
  values: string[];
}

/** 矩阵题的行定义（列复用 options） */
export interface CmsInteractionMatrixRow {
  id: string;
  label: string;
}

export interface CmsInteractionQuestion {
  id: number;
  interactionId: number;
  label: string;
  type: CmsInteractionQuestionType;
  required: boolean;
  options: CmsInteractionOption[];
  minChoices: number;
  maxChoices: number;
  sort: number;
  /** 选择题是否提供「其他 ___」自由填空 */
  allowOther: boolean;
  /** 「其他」选项的展示文案，默认「其他」 */
  otherLabel: string | null;
  /** 评分题上限（NPS 固定 0-10，不读此字段） */
  ratingMax: number;
  /** 矩阵题的行 */
  matrixRows: CmsInteractionMatrixRow[];
  /** 分页问卷的页码，从 1 开始 */
  pageNo: number;
  /** 条件显示规则，为空表示始终显示 */
  visibleWhen: CmsInteractionVisibleWhen | null;
}

export interface CmsInteraction {
  id: number;
  siteId: number;
  code: string;
  kind: CmsInteractionKind;
  title: string;
  description: string | null;
  status: CmsInteractionStatus;
  participantScope: CmsInteractionParticipantScope;
  repeatPolicy: CmsInteractionRepeatPolicy;
  resultVisibility: CmsInteractionResultVisibility;
  captchaPolicy: CmsInteractionCaptchaPolicy;
  turnstileSiteKey: string | null;
  turnstileSecretConfigured: boolean;
  thankYouMessage: string;
  startAt: string | null;
  endAt: string | null;
  responseCount: number;
  questions?: CmsInteractionQuestion[];
  createdAt: string;
  updatedAt: string;
}

/** 统一互动结果统计（选择题计数 + 文本题脱敏样本）。 */
/** 单题统计。选择题看 options，评分/NPS/数字看 average，矩阵看 matrixRows。 */
export interface CmsInteractionQuestionStats {
  id: number;
  label: string;
  type: CmsInteractionQuestionType;
  options: (CmsInteractionOption & { count: number; percent: number })[];
  texts: string[];
  /** 该题实际作答人数（分母，条件显示题会小于总答卷数） */
  answered: number;
  /** 评分 / NPS / 数字题的均值，其余为 null */
  average: number | null;
  /** NPS 净推荐值（推荐者% - 贬损者%），仅 nps 题有值 */
  npsScore: number | null;
  /** 矩阵题按行的选项分布 */
  matrixRows: {
    id: string;
    label: string;
    options: (CmsInteractionOption & { count: number; percent: number })[];
  }[];
}

/** 文本 / 日期 / 「其他」填空的单条答案样本 */
export interface CmsInteractionTextAnswer {
  responseId: number;
  value: string;
  createdAt: string;
}

/** 交叉分析：两道选择题的联合分布 */
export interface CmsInteractionCrossStats {
  xQuestionId: number;
  xLabel: string;
  yQuestionId: number;
  yLabel: string;
  /** 表头（Y 题选项） */
  columns: { value: string; label: string }[];
  /** 每行对应 X 题一个选项 */
  rows: {
    value: string;
    label: string;
    total: number;
    /** 与 columns 等长 */
    cells: { count: number; percent: number }[];
  }[];
}

/** 答卷提交趋势（按天） */
export interface CmsInteractionTrendStats {
  interactionId: number;
  days: number;
  points: { date: string; count: number }[];
}

export interface CmsInteractionStats {
  interactionId: number;
  responseCount: number;
  questions: CmsInteractionQuestionStats[];
}

/** 前台可公开的互动统计；文本答卷永不进入公共响应。 */
export interface CmsInteractionPublicStats {
  interactionId: number;
  responseCount: number;
  questions: {
    id: number;
    label: string;
    type: CmsInteractionQuestionType;
    options: (CmsInteractionOption & { count: number; percent: number })[];
    average: number | null;
    npsScore: number | null;
  }[];
}

export interface CmsInteractionAnswerDetail {
  questionId: number;
  label: string;
  type: CmsInteractionQuestionType;
  /** 选择题为命中的选项文案；文本题为单元素数组 */
  values: string[];
  /** 拼接后的展示文案（多选用「、」连接） */
  display: string;
}

export interface CmsInteractionResponse {
  id: number;
  interactionId: number;
  interactionTitle?: string;
  kind?: CmsInteractionKind;
  memberId: number | null;
  memberDisplay: string | null;
  visitorHash: string;
  ipHash: string;
  answers: Record<string, string | string[]>;
  /** 已关联题目的可读答案，按题目 sort 排序 */
  answerDetails: CmsInteractionAnswerDetail[];
  createdAt: string;
}

export type CmsSubscriptionSubjectType = 'site' | 'channel' | 'author';

export interface CmsMemberSubscription {
  id: number;
  memberId: number;
  memberDisplay?: string | null;
  siteId: number;
  siteName?: string | null;
  subjectType: CmsSubscriptionSubjectType;
  subjectKey: string;
  subjectId: number | null;
  subjectLabel: string;
  notificationEnabled: boolean;
  active: boolean;
  pointsAwardedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsSubscriptionAggregate {
  siteId: number;
  subjectType: CmsSubscriptionSubjectType;
  subjectKey: string;
  subjectId: number | null;
  subjectLabel: string;
  subscriberCount: number;
  notificationEnabledCount: number;
}

export interface CmsTag {
  id: number;
  siteId: number;
  name: string;
  slug: string;
  /** 标签分组（可空；同组标签聚合管理） */
  groupName?: string | null;
  contentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 内容编辑锁状态（软锁，防多人同编相互覆盖） */
export interface CmsEditLock {
  acquired: boolean;
  holder: { userId: number; nickname: string; lockedAt: string } | null;
}

/** 草稿预览链接（签名临时链接） */
export interface CmsPreviewLink {
  url: string;
  expiresAt: string;
}

/** 版本差异对比项（before=历史版本值，after=当前值） */
export interface CmsContentVersionDiff {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** CMS 数据看板统计 */
export interface CmsDashboardStats {
  totals: {
    published: number;
    draft: number;
    pending: number;
    offline: number;
    rejected: number;
    recycled: number;
  };
  pendingComments: number;
  todayPublished: number;
  totalViews: number;
  publishTrend: { date: string; count: number }[];
  topViewed: { id: number; title: string; viewCount: number; channelName: string | null }[];
  channelDistribution: { channelId: number; channelName: string; count: number }[];
}

/** 友链分组（独立实体：支持排序与稳定 code，供主题按组取数） */
export interface CmsFriendLinkGroup {
  id: number;
  siteId: number;
  name: string;
  code: string;
  status: 'enabled' | 'disabled';
  sort: number;
  remark: string | null;
  /** 组内友链数（列表页展示，JOIN 后附加） */
  linkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsFriendLink {
  id: number;
  siteId: number;
  /** 所属分组；null = 未分组 */
  groupId: number | null;
  /** 分组名称（JOIN 后附加） */
  groupName?: string | null;
  name: string;
  url: string;
  logo: string | null;
  status: 'enabled' | 'disabled';
  sort: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 全文检索结果条目（含高亮片段） */
export interface CmsSearchResult {
  id: number;
  siteId: number;
  channelId: number;
  channelName: string | null;
  title: string;
  /** 高亮标题（<mark> 包裹命中词） */
  titleHighlight: string;
  /** 高亮摘要片段 */
  snippet: string;
  url: string;
  /** 外链形态内容：url 即外部地址，前台应新窗口打开且不拼 baseUrl */
  isExternal: boolean;
  publishedAt: string | null;
  rank: number;
}

// ─── CMS P2：版本 / 重定向 / 内链词 / 评论 / 广告 / 表单 / 敏感词 / 推送 ─────────
export type CmsCommentStatus = 'pending' | 'approved' | 'rejected';

export interface CmsContentVersion {
  id: number;
  contentId: number;
  version: number;
  title: string;
  snapshot: Record<string, unknown>;
  remark: string | null;
  /** 操作人昵称（JOIN 后附加） */
  createdByName?: string | null;
  createdAt: string;
}

export interface CmsRedirect {
  id: number;
  siteId: number;
  fromPath: string;
  toUrl: string;
  redirectType: number;
  status: 'enabled' | 'disabled';
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsLinkWord {
  id: number;
  siteId: number;
  keyword: string;
  url: string;
  maxReplaces: number;
  status: 'enabled' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface CmsComment {
  id: number;
  siteId: number;
  contentId: number;
  /** 内容标题（JOIN 后附加） */
  contentTitle?: string | null;
  /** 父评论 id，0 = 顶级 */
  parentId: number;
  /** 父评论昵称（JOIN 后附加） */
  parentNickname?: string | null;
  /** 会员评论：非空表示由登录会员提交 */
  memberId: number | null;
  /** 会员用户名（JOIN 后附加，用于后台辨识） */
  memberUsername?: string | null;
  nickname: string;
  content: string;
  likeCount: number;
  status: CmsCommentStatus;
  /** 风控标注：watchlist=命中观察灰名单（规则中心名单守卫写入）；null=无标注 */
  riskFlag: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 会员端「我的评论」条目 */
export interface CmsMemberComment {
  id: number;
  contentId: number;
  contentTitle: string | null;
  /** 内容前台地址（站点未绑定域名时为相对路径） */
  contentUrl: string | null;
  parentId: number;
  content: string;
  likeCount: number;
  status: CmsCommentStatus;
  createdAt: string;
}

// ─── CMS 素材中心（P2）────────────────────────────────────────────────────────
export type CmsResourceType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface CmsResource {
  id: number;
  siteId: number;
  folderId: number | null;
  folderName?: string | null;
  type: CmsResourceType;
  name: string;
  url: string;
  thumbUrl: string | null;
  fileId: string | null;
  size: number;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  remark: string | null;
  /** false = 仅引用登记（文件由文件中心/来源站点持有），删除素材不会删除物理文件 */
  ownsFile: boolean;
  /** 站内引用数（列表按 cms_resource_refs 聚合后附加，可选） */
  refCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 素材引用位置（删除前校验 / 引用查询） */
export interface CmsResourceReference {
  kind: CmsResourceOwnerType;
  id: number;
  title: string;
  field: string;
}

export interface CmsResourceFolder {
  id: number;
  siteId: number;
  parentId: number | null;
  name: string;
  sort: number;
  resourceCount?: number;
  children?: CmsResourceFolder[];
  createdAt: string;
  updatedAt: string;
}

export interface CmsAdSlot {
  id: number;
  siteId: number;
  code: string;
  name: string;
  remark: string | null;
  /** 投放中的广告数（JOIN 后附加） */
  adCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsAd {
  id: number;
  slotId: number;
  /** 广告位名称（JOIN 后附加） */
  slotName?: string | null;
  name: string;
  image: string | null;
  linkUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  /** 点击计数（前台点击中转累加） */
  clickCount: number;
  /** 曝光计数（前台页面 beacon 上报累加） */
  viewCount: number;
  sort: number;
  status: 'enabled' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export type CmsAdEventType = 'impression' | 'click';

export type CmsDeviceType = 'pc' | 'mobile' | 'bot';

export interface CmsAdEvent {
  id: number;
  siteId: number;
  siteName?: string | null;
  adId: number;
  adName?: string | null;
  slotId: number;
  slotName?: string | null;
  eventType: CmsAdEventType;
  occurredAt: string;
  visitorHash: string;
  ipHash: string;
  userAgent: string | null;
  device: CmsDeviceType;
  referrer: string | null;
  path: string | null;
  memberId: number | null;
}

export interface CmsAdEventStats {
  summary: { impressions: number; clicks: number; ctr: number };
  trend: {
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }[];
}

/** CMS 访问统计总览（P4；bot 流量不计入） */
export interface CmsVisitStats {
  today: { pv: number; uv: number; ips: number };
  yesterday: { pv: number; uv: number; ips: number };
  totalPv: number;
  trend: { date: string; pv: number; uv: number }[];
  topContents: { contentId: number; title: string; pv: number; uv: number }[];
  devices: { deviceType: 'pc' | 'mobile' | 'bot'; pv: number }[];
  referrers: { host: string; pv: number }[];
}

/** CMS 搜索分析（P4） */
export interface CmsSearchAnalytics {
  total: number;
  trend: { date: string; count: number }[];
  topKeywords: { keyword: string; count: number; avgResults: number }[];
  noResultKeywords: { keyword: string; count: number }[];
}

export interface CmsFormField {
  name: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'select' | 'radio' | 'email' | 'mobile' | 'url' | 'number';
  required: boolean;
  options?: { label: string; value: string }[] | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
  min?: number | null;
  max?: number | null;
  errorMessage?: string | null;
}

export interface CmsForm {
  id: number;
  siteId: number;
  code: string;
  name: string;
  fields: CmsFormField[];
  successMessage: string | null;
  /** 新提交通知邮箱（逗号分隔多个，空 = 不通知） */
  notifyEmail: string | null;
  captchaProvider: 'inherit' | 'none' | 'math' | 'turnstile';
  turnstileSiteKey: string | null;
  /** API 仅返回掩码；空串/掩码保留，null 清除 */
  turnstileSecret: string | null;
  status: 'enabled' | 'disabled';
  /** 提交数（JOIN 后附加） */
  submissionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsFormSubmission {
  id: number;
  formId: number;
  data: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CmsSensitiveWord {
  id: number;
  word: string;
  replaceWith: string | null;
  status: 'enabled' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface CmsPushLog {
  id: number;
  siteId: number;
  engine: string;
  urls: string[];
  success: boolean;
  statusCode: number | null;
  response: string | null;
  createdAt: string;
}

// ─── CMS P3 Batch1 ────────────────────────────────────────────────────────────
export interface CmsSearchWord {
  id: number;
  siteId: number;
  word: string;
  type: 'extension' | 'stop';
  groupName: string;
  weight: number;
  status: 'enabled' | 'disabled';
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsHotKeyword {
  id: number | null;
  siteId: number;
  groupId: number | null;
  groupName: string | null;
  keyword: string;
  count: number;
  sort: number;
  status: 'enabled' | 'disabled';
}

export interface CmsHotwordGroup {
  id: number;
  siteId: number;
  name: string;
  sort: number;
  status: 'enabled' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

// ─── CMS 会员投稿（P3 Batch4）──────────────────────────────────────────────────
export interface CmsContribution {
  id: number;
  siteId: number;
  channelId: number;
  channelName: string | null;
  title: string;
  summary: string | null;
  coverImage: string | null;
  body: string | null;
  status: CmsContentStatus;
  rejectReason: string | null;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CmsContribSite {
  id: number;
  name: string;
  channels: { id: number; name: string }[];
}

// ─── CMS 采集中心（P3 Batch5）─────────────────────────────────────────────────
export interface CmsCollectRule {
  id: number;
  siteId: number;
  channelId: number;
  channelName: string | null;
  name: string;
  listUrl: string;
  pageStart: number;
  pageEnd: number;
  listSelector: string;
  titleSelector: string;
  bodySelector: string;
  summarySelector: string | null;
  coverSelector: string | null;
  removeSelectors: string[];
  autoPublish: boolean;
  localizeImages: boolean;
  maxItems: number;
  status: 'enabled' | 'disabled';
  lastRunAt: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsCollectItem {
  id: number;
  ruleId: number;
  url: string;
  title: string | null;
  status: 'success' | 'skipped' | 'failed';
  contentId: number | null;
  error: string | null;
  createdAt: string;
}

// ─── CMS 可视化页面搭建（P3 Batch6）───────────────────────────────────────────
export type CmsPageBlockType = 'hero' | 'richtext' | 'image' | 'content-list' | 'columns' | 'widget-ref';

export type CmsPageBlockAudience = 'always' | 'guest' | 'member';

export interface CmsPageBlockDisplayCondition {
  audience: CmsPageBlockAudience;
  startAt?: string | null;
  endAt?: string | null;
}

export interface CmsPageBlock {
  id: string;
  type: CmsPageBlockType;
  props: Record<string, unknown>;
  displayCondition?: CmsPageBlockDisplayCondition;
  /** 管理端详情按当前用户计算；写入时忽略。 */
  canManage?: boolean;
  aclConfigured?: boolean;
  disabledReason?: string | null;
}

export type CmsPageBlockAclSubjectType = 'user' | 'role';

export interface CmsPageBlockAcl {
  id: number;
  pageId: number;
  blockId: string;
  subjectType: CmsPageBlockAclSubjectType;
  subjectId: number;
  subjectName: string | null;
  createdAt: string;
}

export interface CmsPage {
  id: number;
  siteId: number;
  name: string;
  slug: string;
  /**
   * 自定义访问路径（已归一：无前后斜杠、无 `/index.html` 后缀）。
   * 为空时前台路径回落 `/p/{slug}/`。
   */
  path: string | null;
  isHome: boolean;
  blocks: CmsPageBlock[];
  /** guest/member 展示条件存在时强制动态渲染，禁止静态输出。 */
  requiresDynamic: boolean;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  status: 'enabled' | 'disabled';
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CMS_PAGE_BLOCK_TYPES: { value: CmsPageBlockType; label: string }[] = [
  { value: 'hero', label: 'Hero 横幅' },
  { value: 'richtext', label: '富文本' },
  { value: 'image', label: '图片' },
  { value: 'content-list', label: '内容列表' },
  { value: 'columns', label: '多列卡片' },
  { value: 'widget-ref', label: '页面部件' },
];

// ─── CMS 页面部件 ─────────────────────────────────────────────────────────────
export type CmsWidgetType = 'manual-list';

export type CmsWidgetStatus = 'draft' | 'published' | 'offline';

export type CmsWidgetSourceType = 'manual' | 'content' | 'channel';

export type CmsWidgetRendererKey = 'list-sidebar' | 'list-grid' | 'list-carousel';

export type CmsWidgetRefOwnerType = 'page' | 'theme_slot';

export type CmsWidgetSlotKey = 'home.sidebar';

export interface CmsWidgetItem {
  id: string;
  sourceType: CmsWidgetSourceType;
  sourceId?: number | null;
  /** 来源字段的人工覆盖；空值表示跟随实时来源。手工条目至少填写 title。 */
  title?: string | null;
  summary?: string | null;
  url?: string | null;
  image?: string | null;
  displayDate?: string | null;
}

export interface CmsWidgetData {
  items: CmsWidgetItem[];
}

export interface CmsWidget {
  id: number;
  siteId: number;
  name: string;
  code: string;
  type: CmsWidgetType;
  schemaVersion: number;
  draftData: CmsWidgetData;
  publishedData: CmsWidgetData | null;
  publishedName: string | null;
  draftRevision: number;
  publishedRevision: number;
  status: CmsWidgetStatus;
  defaultRendererKey: CmsWidgetRendererKey;
  remark: string | null;
  referenceCount: number;
  impactCount: number;
  highFanout: boolean;
  hasUnpublishedChanges: boolean;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsWidgetRef {
  id: number;
  siteId: number;
  widgetId: number;
  ownerType: CmsWidgetRefOwnerType;
  ownerId: number;
  field: string;
  rendererKey: CmsWidgetRendererKey;
  styleProps: Record<string, unknown>;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsResolvedWidgetItem {
  id: string;
  sourceType: CmsWidgetSourceType;
  sourceId: number | null;
  title: string;
  summary: string | null;
  url: string | null;
  image: string | null;
  displayDate: string | null;
}

export interface CmsResolvedWidget {
  id: number;
  name: string;
  type: CmsWidgetType;
  rendererKey: CmsWidgetRendererKey;
  items: CmsResolvedWidgetItem[];
}

export interface CmsWidgetRendererOption {
  key: CmsWidgetRendererKey;
  label: string;
}

export interface CmsWidgetPreview {
  siteId: number;
  widget: CmsResolvedWidget;
  html: string;
  documentHtml: string;
  renderers: CmsWidgetRendererOption[];
}

export interface CmsWidgetSourceReference {
  widgetId: number;
  widgetName: string;
  widgetCode: string;
  itemId: string;
  sourceType: Exclude<CmsWidgetSourceType, 'manual'>;
  sourceId: number;
  referenceCount: number;
  impactCount: number;
  highFanout: boolean;
}

export interface CmsWidgetSlot {
  key: CmsWidgetSlotKey;
  label: string;
  allowedTypes: CmsWidgetType[];
  rendererKeys: CmsWidgetRendererKey[];
  binding: CmsWidgetRef | null;
}

export interface CmsSiteImportResult {
  siteId: number;
  siteName: string;
  siteCode: string;
  counts: Record<string, number>;
  skipped: { widgetSlots: number };
  warnings: string[];
}
