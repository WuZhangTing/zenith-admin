import type { SystemSchedulerTaskBase } from '../platform/types';
import type { WorkflowFormType } from './constants';

// ─── 工作流引擎 ───────────────────────────────────────────────────────────────
export type WorkflowDefinitionStatus = 'draft' | 'published' | 'disabled';

export type WorkflowInstanceStatus = 'draft' | 'running' | 'suspended' | 'approved' | 'rejected' | 'withdrawn' | 'cancelled';

export type WorkflowTaskStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'waiting';

export type WorkflowTaskExternalDispatchStatus = 'pending' | 'dispatched' | 'failed' | 'fallback';

export type WorkflowNodeType =
  | 'start'
  | 'approve'
  | 'handler'
  | 'end'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'inclusiveGateway'
  | 'routeGateway'
  | 'ccNode'
  | 'delay'
  | 'trigger'
  | 'subProcess'
  | 'catchNode';

export type WorkflowConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'between' | 'withinDays' | 'beforeDays';

/** 子流程调用模式 */
export type WorkflowSubProcessMode = 'single' | 'multi';

/** 子流程多实例执行方式 */
export type WorkflowSubProcessExecution = 'parallel' | 'serial';

/** 子流程多实例下，某个子实例驳回时的处理策略 */
export type WorkflowSubProcessChildRejectPolicy = 'abort' | 'continue';

/** 子流程子实例发起人来源 */
export type WorkflowSubProcessInitiator = 'parentInitiator' | 'formField' | 'specifiedUser';

// 连线条件表达式（排他网关出边使用）
export interface WorkflowEdgeCondition {
  field: string;         // source='form' 时为表单字段 key；source='starter' 时为 'user'|'dept'|'role'|'post'
  operator: WorkflowConditionOperator;
  value: string | number | boolean;
  /** 条件来源：'form'(默认)=按表单字段；'starter'=按发起人维度（本人/部门/角色/岗位） */
  source?: 'form' | 'starter';
  /** 明细子表聚合：对 field（数组型明细字段）按 aggregateField 列做聚合后再比较 */
  aggregate?: 'sum' | 'count' | 'avg';
  /** 聚合列 key（aggregate 设置时生效；count 可不填） */
  aggregateField?: string;
}

/**
 * 发起人运行时上下文快照，供条件分支「发起人维度」求值。
 * deptIds 含发起人所在部门及其全部上级部门（实现「选父部门即覆盖子部门」语义）。
 */
export interface WorkflowStarterContext {
  userId: number;
  deptIds: number[];
  roleIds: number[];
  postIds: number[];
}

export interface WorkflowConditionGroup {
  type: 'and' | 'or';
  rules: WorkflowEdgeCondition[];
}

/** 审批人来源类型 */
export type WorkflowAssigneeType =
  | 'user'                       // 指定成员
  | 'role'                       // 指定角色
  | 'department'                 // 部门负责人
  | 'userGroup'                  // 用户组
  | 'post'                       // 指定岗位
  | 'deptMember'                 // 指定部门成员（可选包含子部门）
  | 'initiator'                  // 发起人本人
  | 'initiatorLeader'            // 发起人上级（兼容旧字段）
  | 'initiatorDept'              // 发起人部门主管（兼容旧字段）
  | 'startUserDeptResponsible'   // 发起人部门分管领导
  | 'manager'                    // 直属主管（支持多层级 managerLevel）
  | 'multiLevelManager'          // 连续多级上级
  | 'multiLevelDeptHead'         // 连续多级部门负责人
  | 'formUser'                   // 表单内联系人字段
  | 'formDepartment'             // 表单内部门字段
  | 'nodeApprover'               // 节点审批人（关联前序节点）
  | 'initiatorSelect'            // 发起人自选（在发起时已经填到 userIds 中）
  | 'initiatorSelectScope'       // 发起人自选指定范围
  | 'approverSelect'             // 上一节点审批人自选
  | 'decision'                   // 审批人矩阵：决策表输出来源类型+id
  | 'expression';
                // 流程表达式

/** 审批方式 */
/**
 * 审批方式（**设计态**意图，存于 flowData 节点配置）。
 * 其中 `random`/`auto` 不是落库的多人审批方式，而是更高层的派发意图：
 * - `auto`：节点自动通过（引擎在创建任务前即生成 approved 任务并续接，等价 approvalType='autoApprove'）
 * - `random`：在候选审批人中随机指派一人（落库时退化为单人 → 运行态方式为 or）
 * 运行态/落库的方式仅 {@link WorkflowResolvedApproveMethod} 四种，二者由
 * `resolveRuntimeApproveMethod()` 在任务展开时显式转换，避免「设计态 6 值 / 运行态 4 值」隐性错配。
 */
export type WorkflowApproveMethod =
  | 'and'         // 会签：所有人通过
  | 'or'          // 或签：任一人通过
  | 'sequential'  // 顺序会签：按顺序逐一通过
  | 'ratio'       // 比例会签：达到指定百分比通过即可
  | 'random'      // 随机挑选一人审批（系统在候选人中随机指派一人）
  | 'auto';
       // 自动通过

/**
 * 运行态/落库的多人审批方式（workflow_tasks.approve_method 列与 DB pg enum 一致，4 值）。
 * 设计态的 `random`/`auto` 经 `resolveRuntimeApproveMethod()` 解析后只会落到这 4 个值之一。
 */
export type WorkflowResolvedApproveMethod = Exclude<WorkflowApproveMethod, 'random' | 'auto'>;

export type WorkflowApprovalType = 'manual' | 'autoApprove' | 'autoReject';

export type WorkflowEmptyAssigneeStrategy = 'autoApprove' | 'assignToAdmin' | 'reject' | 'assignTo';

export type WorkflowSameInitiatorStrategy = 'selfApprove' | 'autoSkip' | 'toDirectManager' | 'toDeptHead';

export type WorkflowDeduplicateStrategy = 'autoSkip' | 'repeatApprove';

/** 流程级「自动去重」模式：同一审批人在流程中重复出现时的处理方式 */
export type WorkflowApproverDedupMode =
  | 'none'         // 不自动通过
  | 'all'          // 仅审批一次，后续重复的审批节点均自动通过
  | 'consecutive';
 // 仅针对连续审批的节点自动通过
export type WorkflowOperationPermission =
  | 'approve'
  | 'reject'
  | 'comment'
  | 'signature'
  | 'opinionRequired';

export type WorkflowFieldPermission = 'read' | 'edit' | 'hidden';

/** 审批操作按钮 key（运行时支持的任务动作） */
export type WorkflowActionButtonKey =
  | 'approve'    // 通过
  | 'reject'     // 拒绝
  | 'transfer'   // 转办
  | 'delegate'   // 委派
  | 'addSign'    // 加签
  | 'reduceSign' // 减签
  | 'return';
    // 退回

/**
 * 附件配置（执行此动作时的附件上传策略）：
 * - hidden：不显示附件上传区（默认）
 * - optional：显示附件上传区，选填
 * - required：显示附件上传区，必填
 */
export type WorkflowActionUploadMode = 'hidden' | 'optional' | 'required';

/** 单个操作按钮的配置 */
export interface WorkflowActionButtonConfig {
  /** 是否启用此按钮 */
  enabled: boolean;
  /** 按钮显示名称（覆盖默认文案） */
  displayName?: string;
  /** 审批意见输入框的标签文案 */
  opinionName?: string;
  /** 跳转配置：拒绝/退回时跳转到目标节点 key（仅 reject / return 生效） */
  jumpToNodeKey?: string;
  /** 附件配置：执行此动作时的附件上传策略（不显示/选填/必填），默认 hidden */
  uploadMode?: WorkflowActionUploadMode;
}

export interface WorkflowTimeoutConfig {
  enabled: boolean;
  duration: number;
  /** 时间单位（默认 hours，向后兼容） */
  unit?: 'minutes' | 'hours' | 'days';
  action: 'remind' | 'autoApprove' | 'autoReject';
  remindCount?: number;
  /**
   * 当 action='remind' 且提醒次数耗尽仍未处理时的升级动作。
   * 'none'(默认)=保持挂起；'autoApprove'/'autoReject'=自动同意/拒绝；
   * 'transferToManager'=转交给当前处理人的上级（按 escalateManagerLevel 取上级层级）。
   */
  escalateAction?: 'none' | 'autoApprove' | 'autoReject' | 'transferToManager';
  /** escalateAction='transferToManager' 时的上级层级（1=直属上级，默认 1） */
  escalateManagerLevel?: number;
  /**
   * transferToManager 找不到上级、部门负责人、管理员时的最终兜底策略。
   * 默认 none = 保持挂起但停止重复扫描；也可配置为自动同意/拒绝。
   */
  escalateFallbackAction?: 'none' | 'autoApprove' | 'autoReject';
}

/** 审批节点被驳回时的处理策略 */
export type WorkflowRejectStrategy =
  | 'terminate'      // 终止流程
  | 'returnPrev'     // 退回上一审批节点
  | 'returnStart'    // 退回发起人（从头开始）
  | 'returnToNode';
  // 退回到指定节点（由 rejectToNodeKey 指定）

// 流程节点配置（存在 flowData JSON 中）
export interface WorkflowNodeConfig {
  key: string;       // 节点唯一标识
  type: WorkflowNodeType;
  label: string;     // 显示名称
  assigneeId?: number | null;   // 审批人 ID（approve 节点单人）
  assigneeName?: string | null;
  assigneeIds?: number[] | null;  // 抄送节点 / 多人配置：多个接收人 ID
  assigneeNames?: string[] | null;
  isDefault?: boolean;            // 排他网关：是否默认出口
  /** 审批人来源类型（人工节点） */
  assigneeType?: WorkflowAssigneeType;
  approvalType?: WorkflowApprovalType;
  excludeFromStats?: boolean;
  /** 当 assigneeType = 'user' 时指定的成员 IDs */
  userIds?: number[] | null;
  /** 当 assigneeType = 'role' 时指定的角色 IDs */
  roleIds?: number[] | null;
  /** 当 assigneeType = 'department' 时指定的部门 IDs */
  deptIds?: number[] | null;
  /** 当 assigneeType = 'userGroup' 时指定的用户组 IDs */
  userGroupIds?: number[] | null;
  /** 当 assigneeType = 'post' 时指定的岗位 IDs */
  postIds?: number[] | null;
  postNames?: string[] | null;
  /** 当 assigneeType = 'deptMember' 时指定的部门 IDs（成员为这些部门下的所有用户） */
  deptMemberDeptIds?: number[] | null;
  deptMemberDeptNames?: string[] | null;
  /** deptMember：是否包含子部门成员（默认 false） */
  deptMemberIncludeChildren?: boolean;
  /** 自选范围类型（approverSelect / initiatorSelectScope 时生效） */
  selectScopeType?: 'user' | 'role' | 'department' | 'userGroup';
  /** 自选范围 IDs（与 selectScopeType 对应） */
  selectScopeIds?: number[] | null;
  /** 流程表达式（assigneeType = 'expression' 时生效，返回用户 ID 数组或单值） */
  assigneeExpression?: string;
  /** 审批方式（人工节点，多人时生效） */
  approveMethod?: WorkflowApproveMethod;
  /** 比例会签阈值（百分比 1-100，仅 approveMethod='ratio' 时生效） */
  approveRatio?: number;
  emptyStrategy?: WorkflowEmptyAssigneeStrategy;
  /** 空审批人策略=assignTo 时的转交人 ID 列表（多人时会签） */
  emptyAssignToIds?: number[] | null;
  emptyAssignToNames?: string[] | null;
  sameInitiatorStrategy?: WorkflowSameInitiatorStrategy;
  deduplicateStrategy?: WorkflowDeduplicateStrategy;
  operations?: WorkflowOperationPermission[];
  /** 操作按钮配置：每个 key 对应一个按钮的显示/启用/上传/跳转设置 */
  actionButtons?: Partial<Record<WorkflowActionButtonKey, WorkflowActionButtonConfig>>;
  fieldPermissions?: Record<string, WorkflowFieldPermission>;
  timeout?: WorkflowTimeoutConfig;
  /** manager / multiLevelManager 的层级（1 = 直属上级） */
  managerLevel?: number;
  /** 多级模式的终点类型 */
  multiLevelEndType?: 'topLevel' | 'level' | 'role';
  multiLevelEndLevel?: number;
  multiLevelEndRoleId?: number;
  /** formUser 策略：表单中联系人字段的 key */
  formUserField?: string;
  /** formDepartment 策略：表单中部门字段的 key */
  formDeptField?: string;
  formDeptHeadLevel?: number;
  /** nodeApprover 策略：关联前序节点 ID */
  nodeApproverNodeId?: string;
  /** 审批被驳回时的处理策略（仅 approve / handler 节点有意义；缺省视为 terminate） */
  rejectStrategy?: WorkflowRejectStrategy;
  /** 当 rejectStrategy = 'returnToNode' 时，目标节点的 key */
  rejectToNodeKey?: string;
  /** 触发器节点配置（type === 'trigger' 时生效） */
  triggerConfig?: WorkflowTriggerNodeConfig;
  /** 外部审批配置（type === 'approve' 时生效） */
  externalApproval?: WorkflowExternalApprovalConfig;
  onlyOnApprove?: boolean;
  subProcessId?: number;
  subProcessName?: string;
  /** 子流程：父实例字段映射到子实例 formData（key=子字段 key，value 支持 {{form.x}} / {{item}} 模板） */
  subProcessFieldMapping?: Record<string, string>;
  /** 子流程：子实例结束后回填父实例 formData（key=父字段 key，value=子字段 key；多实例时聚合为数组） */
  subProcessOutputMapping?: Record<string, string>;
  /** 子流程：是否等待子实例结束才推进父流程（默认 true） */
  subProcessWaitChild?: boolean;
  /** 子流程：调用模式 —— single 单实例（默认） / multi 多实例（遍历集合字段，逐项发起子流程） */
  subProcessMode?: WorkflowSubProcessMode;
  /** 子流程（multi）：循环数据源 —— 父表单中数组型字段 key（multiSelect/checkbox/tags/userSelect/deptSelect 等） */
  subProcessMultiSource?: string;
  /** 子流程（multi）：多实例执行方式 —— parallel 并行（默认） / serial 串行 */
  subProcessMultiExecution?: WorkflowSubProcessExecution;
  /** 子流程（multi）：将当前循环项的值写入子实例 formData 的字段 key（亦可在映射中用 {{item}} 引用） */
  subProcessMultiItemKey?: string;
  /** 子流程（multi）：某个子实例被驳回时 —— abort 中止整个节点（默认） / continue 忽略并继续其余实例 */
  subProcessOnChildReject?: WorkflowSubProcessChildRejectPolicy;
  /** 子流程：子实例发起人 —— parentInitiator 父流程发起人（默认） / formField 取表单字段 / specifiedUser 指定成员 */
  subProcessInitiator?: WorkflowSubProcessInitiator;
  /** 子流程：subProcessInitiator='formField' 时，存放用户 ID 的父表单字段 key */
  subProcessInitiatorField?: string;
  /** 子流程：subProcessInitiator='specifiedUser' 时，指定的用户 ID */
  subProcessInitiatorUserId?: number;
  /** 子流程：子实例被驳回时是否忽略并按通过继续父流程（默认 false，遵循 rejectStrategy） */
  subProcessIgnoreReject?: boolean;
  isAsync?: boolean;
  /** 延迟节点：延迟类型 */
  delayType?: 'fixed' | 'toDate';
  /** 延迟节点（fixed）：时长数值 */
  delayValue?: number;
  /** 延迟节点（fixed）：时长单位 */
  delayUnit?: 'minute' | 'hour' | 'day';
  /** 延迟节点（toDate）：表单中目标日期字段的 key */
  targetDate?: string;
  /** 节点级事件监听器（独立于定义级订阅，按节点配置在设计器中维护） */
  nodeListeners?: NodeListenerConfig[];
  /** 退回模式（approve/handler）：reexecute 重新执行后续路径（默认）/ backToOrigin 被退回节点通过后直接跳回发起退回的节点 */
  returnMode?: 'reexecute' | 'backToOrigin';
  /** 异常捕获节点（type='catchNode'）的动作 */
  catchAction?: 'toAdmin' | 'notify' | 'terminate';
  /** catchAction='notify' 时额外通知的用户 ID（默认通知发起人+管理员） */
  catchNotifyUserIds?: number[] | null;
  /** routeGateway：决策表 key，运行时进入网关前求值并把输出并入 formData，供出边条件选支 */
  decisionRuleKey?: string | null;
  /** 统一失败策略（外部副作用节点 trigger/subProcess/externalApproval 等；设置后优先于 legacy onFailure/catch 语义） */
  failurePolicy?: WorkflowNodeFailurePolicy;
}

/** 节点监听器触发事件 */
export type NodeListenerEvent = 'onCreate' | 'onApprove' | 'onReject';

/** 节点级事件监听器（webhook） */
export interface NodeListenerConfig {
  type: 'webhook';
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  events: NodeListenerEvent[];
}

/** 触发器节点配置 */
export interface WorkflowTriggerNodeConfig {
  triggerType: WorkflowTriggerType;
  /** 经连接器调用：引用流程连接器 id（设置后由连接器提供基础地址/鉴权/超时/重试/熔断，webhookUrl 退化为相对路径） */
  connectorId?: number;
  /** webhook / callback：目标 URL（设置 connectorId 时作为相对 connector baseUrl 的路径，可空） */
  webhookUrl?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  /** 请求体模板（支持 {{form.field}} 占位） */
  bodyTemplate?: string;
  /** updateData / deleteData：操作的表单字段 key 列表 */
  fieldKeys?: string[];
  /** updateData：字段 key → 新值（支持 {{form.field}} 占位） */
  fieldValues?: Record<string, string>;
  /** 失败策略 */
  onFailure?: 'continue' | 'retry' | 'block';
  maxRetries?: number;
  timeoutMs?: number;
  /** callback 类型回调验签模式（默认 hmacSha256；历史流程显式 none 时才不验签） */
  callbackSignMode?: 'none' | 'hmacSha256';
  /** callback 类型 HMAC 密钥（callbackSignMode='hmacSha256' 时必填） */
  callbackSecret?: string;
}

/** 外部审批配置 */
export interface WorkflowExternalApprovalConfig {
  enabled: boolean;
  /** 经连接器调用：引用 http 连接器 id（设置后 url 退化为相对连接器基础地址的路径） */
  connectorId?: number;
  url: string;
  secret: string;
  signMode?: WorkflowEventSignMode;
  timeoutMs?: number;
  /** 调用外部 URL 失败时的兜底策略 */
  fallbackStrategy?: 'manual' | 'autoApprove' | 'autoReject';
}

/**
 * 副作用节点失败时的统一处理动作（Saga / 补偿）。
 * - continue：忽略失败，继续流程
 * - retry：按 maxRetries 重试（复用作业引擎指数退避）
 * - compensate：执行反向 / 补偿动作（撤单、解锁库存等）并生成补偿工单
 * - fallback：跳转备用节点 或 执行备选动作（如通知失败改发短信）
 * - notify：通知管理员并挂起为「待人工修复」补偿工单
 * - terminate：终止流程实例
 */
export type WorkflowNodeFailureAction =
  | 'continue'
  | 'retry'
  | 'compensate'
  | 'fallback'
  | 'notify'
  | 'terminate';

/** 补偿 / 反向 / 兜底动作类型 */
export type WorkflowCompensationActionType =
  | 'none'
  | 'http'
  | 'connector'
  | 'sms'
  | 'email'
  | 'updateData';

/**
 * 补偿 / 反向动作配置（可复用于 compensate 反向动作与 fallback 备选动作）。
 * 占位符统一支持：{{form.字段}} / {{instanceId}} / {{nodeKey}} / {{error}}。
 */
export interface WorkflowCompensationAction {
  type: WorkflowCompensationActionType;
  /** connector：引用流程连接器 id（设置后 url 退化为相对连接器基础地址的路径） */
  connectorId?: number;
  /** http / connector：目标 URL */
  url?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  /** 请求体模板（支持占位符） */
  bodyTemplate?: string;
  /** sms / email：模板 id */
  templateId?: number;
  /** sms / email：收件人（手机号 / 邮箱，支持占位符）；留空回退发起人 */
  recipients?: string[];
  /** updateData：要回填 / 回滚的父实例表单字段 key 列表 */
  fieldKeys?: string[];
  /** updateData：字段 key → 新值（支持占位符） */
  fieldValues?: Record<string, string>;
  /** 幂等键模板（默认 compensate:{{instanceId}}:{{nodeKey}}） */
  idempotencyKeyTemplate?: string;
  /** 反向动作自身失败时的最大重试次数（默认 3） */
  maxRetries?: number;
  timeoutMs?: number;
}

/** 节点级统一失败策略（附加在任意外部副作用节点，设置后优先于 legacy 语义） */
export interface WorkflowNodeFailurePolicy {
  action: WorkflowNodeFailureAction;
  /** action='retry' 时最大重试次数 */
  maxRetries?: number;
  /** action='fallback' 时跳转的备用节点 key（与 fallbackAction 二选一） */
  fallbackNodeKey?: string;
  /** action='fallback' 时执行的备选动作（与 fallbackNodeKey 二选一） */
  fallbackAction?: WorkflowCompensationAction;
  /** action='compensate' 时执行的反向动作 */
  compensation?: WorkflowCompensationAction;
  /** action='notify' 时额外通知的用户 ID */
  notifyUserIds?: number[] | null;
  /** 补偿 / 兜底动作完成后是否继续推进流程（默认按 action 语义：compensate/notify 挂起、fallback 继续） */
  continueAfter?: boolean;
  /**
   * Saga 反序回滚：本节点失败时，是否触发对该实例此前所有已成功副作用的反序补偿（默认 false）。
   * 开启后引擎按副作用成功顺序倒序逐个执行各节点配置的 compensation。
   */
  sagaRollback?: boolean;
}

// React Flow 数据结构（flowData JSON）
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  condition?: WorkflowEdgeCondition | null;  // 排他网关出边的条件
  conditions?: WorkflowConditionGroup[] | null;
  isDefault?: boolean;
  /** 异常边：当 source 节点执行异常时走向 target（通常指向 catchNode） */
  isException?: boolean;
}

/** 业务编号 / 流水号生成规则 */
/** 业务编号日期段格式（均为标准 dayjs 模板串，可直接用于格式化） */
export type WorkflowSerialDateFormat =
  | 'none'
  | 'YYYYMMDD'
  | 'YYYY-MM-DD'
  | 'YYYY/MM/DD'
  | 'YYYYMM'
  | 'YYYY-MM'
  | 'YYYY'
  | 'YY'
  | 'YYYYMMDDHHmmss';

/** 业务编号序号重置周期 */
export type WorkflowSerialResetPeriod = 'never' | 'daily' | 'monthly' | 'yearly';

/** 业务编号配置模式：structured=分项配置（默认）；template=自定义模板 */
export type WorkflowSerialNoMode = 'structured' | 'template';

export interface WorkflowSerialNoConfig {
  enabled: boolean;
  /** 配置模式，缺省视为 structured */
  mode?: WorkflowSerialNoMode;
  /** 固定前缀，如 'BX-'（structured 模式） */
  prefix?: string;
  /** 固定后缀（structured 模式） */
  suffix?: string;
  /** 日期段与序号段之间的分隔符（structured 模式），默认空 */
  separator?: string;
  /** 日期段格式（structured 模式，拼接在前缀后） */
  dateFormat?: WorkflowSerialDateFormat;
  /** 序号位数（左补零），默认 4 */
  seqLength?: number;
  /** 序号起始值，默认 1 */
  seqStart?: number;
  /** 序号递增步长，默认 1 */
  seqStep?: number;
  /** 自定义模板串（template 模式），含占位符，如 'BX-{YYYYMMDD}-{SEQ:4}' */
  template?: string;
  /** 序号重置周期 */
  resetPeriod?: WorkflowSerialResetPeriod;
}

export interface WorkflowAdvancedSettings {
  allowWithdraw: boolean;
  allowResubmit: boolean;
  notifyInitiator: boolean;
  /** 流程级「自动去重」模式（同一审批人在流程中重复出现时的处理方式） */
  approverDedupMode?: WorkflowApproverDedupMode;
  /** 是否允许在实例下自由评论（默认 true） */
  allowComment?: boolean;
  /** 待办/列表摘要字段（≤3 个表单字段 key，钉钉式卡片摘要） */
  summaryFields?: string[];
  /** 业务编号生成规则 */
  serialNo?: WorkflowSerialNoConfig;
  /** 待办/结果的多渠道通知（站内信始终开启；email/sms 可选） */
  notifyChannels?: WorkflowNotifyChannels;
}

/** 多渠道通知配置 */
export interface WorkflowNotifyChannels {
  /** 邮件通知（向处理人/发起人发送自由内容邮件） */
  email?: boolean;
  /** 短信通知（需指定短信模板 ID） */
  sms?: boolean;
  /** 短信模板 ID（sms=true 时生效） */
  smsTemplateId?: number;
}

export interface WorkflowFlowData {
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: WorkflowNodeConfig;
  }>;
  edges: WorkflowEdge[];
  /** 钉钉/飞书风格流程树结构（新版设计器使用） */
  process?: Record<string, unknown>;
  settings?: WorkflowAdvancedSettings;
}

/** 待办/实例列表摘要项（由 summaryFields 配置 + 表单快照解析得到） */
export interface WorkflowInstanceSummaryItem {
  key: string;
  label: string;
  value: string;
}

/** 任务转办明细（转办/委派/管理员改派/离职交接/超时升级留痕） */
export interface WorkflowTaskTransfer {
  id: number;
  fromUserId: number | null;
  fromUserName?: string | null;
  toUserId: number;
  toUserName?: string | null;
  action: 'transfer' | 'delegate' | 'reassign' | 'handover' | 'timeout';
  reason?: string | null;
  operatorName?: string | null;
  createdAt: string;
}

/** 离职交接影响范围预览 */
export interface WorkflowHandoverPreview {
  fromUserName: string;
  pendingTaskCount: number;
  waitingTaskCount: number;
  /** 交接人名下启用中的审批代理规则数 */
  delegationCount: number;
  /** 已发布定义中将其写死为「指定成员」审批人的节点清单（仅提示，需人工调整定义） */
  affectedDefinitions: Array<{ id: number; name: string; nodeNames: string[] }>;
}

/** 离职交接执行结果（逐条改派互不阻断） */
export interface WorkflowHandoverResult {
  taskTotal: number;
  succeeded: number;
  failed: number;
  delegationsDisabled: number;
  results: Array<{ taskId: number; title: string; nodeName: string; success: boolean; message?: string }>;
}

// 表单字段类型
export type WorkflowFormFieldType =
  | 'text'          // 单行文本
  | 'textarea'      // 多行文本
  | 'number'        // 数字
  | 'date'          // 日期
  | 'dateRange'     // 日期区间
  | 'time'          // 时间
  | 'select'        // 单选下拉
  | 'multiSelect'   // 多选下拉
  | 'autoComplete'  // 自动完成（带建议的输入）
  | 'radio'         // 单选框组
  | 'checkbox'      // 复选框组
  | 'switch'        // 开关
  | 'slider'        // 滑块
  | 'tags'          // 标签录入
  | 'colorPicker'   // 颜色选择器
  | 'amount'        // 金额
  | 'phone'         // 手机号
  | 'email'         // 邮箱
  | 'idCard'        // 身份证
  | 'url'           // 网址
  | 'password'      // 密码
  | 'pinCode'       // PIN 码 / 验证码
  | 'rate'          // 评分
  | 'formula'       // 公式计算
  | 'attachment'    // 附件
  | 'image'         // 图片
  | 'region'        // 省市区联动
  | 'signature'     // 手写签名
  | 'richtext'      // 富文本
  | 'userSelect'    // 用户选择器（系统集成）
  | 'deptSelect'    // 部门选择器（系统集成）
  | 'dictSelect'    // 数据字典选择器（系统集成）
  | 'cascader'      // 级联选择（树形选项，自定义层级）
  | 'nps'           // NPS 净推荐值量表（0-10 打分）
  | 'matrix'        // 矩阵量表（多行同一组选项打分/选择）
  | 'location'      // 定位（经纬度 + 地址文本）
  | 'detail'        // 明细/表格
  | 'description'   // 说明文字
  | 'serialNumber'  // 流水号
  | 'relation'      // 关联审批单（引用其他流程实例）
  | 'row'           // 栅格行
  | 'divider'       // 分割线
  | 'group'         // 分组标题
  | 'tabs'          // 标签页容器（多面板切换）
  | 'steps';
        // 分步容器（向导式分页）

// 字段显隐条件
export interface WorkflowFieldVisibilityCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'notEmpty';
  value: unknown;
}

/** 规则组条目：单条条件，或嵌套子组（支持「A 且 (B 或 C)」结构） */
export type WorkflowFieldVisibilityRule = WorkflowFieldVisibilityCondition | WorkflowFieldVisibilityRuleGroup;

/** 字段级高级联动：多条件 and/or 组合显隐（rules 可含嵌套子组） */
export interface WorkflowFieldVisibilityRuleGroup {
  logic: 'and' | 'or';
  rules: WorkflowFieldVisibilityRule[];
}

export interface WorkflowFormFieldColumn {
  span: number;          // 1-24 grid span
  fields: WorkflowFormField[];
}

/** 增强选项项（select/multiSelect/radio/checkbox）：支持独立 value/label、颜色、禁用 */
export interface WorkflowFormFieldOptionItem {
  value: string;
  label?: string;        // 显示文案，缺省取 value
  color?: string;        // 选项标签颜色（十六进制，如 #1677ff）
  disabled?: boolean;    // 是否禁用该选项
  imageUrl?: string;     // 选项配图 URL（radio 渲染为图片卡片单选）
}

/** 跨字段比较校验规则：当前字段值与目标字段值比较，不满足时报错 */
export interface WorkflowFormFieldCompareRule {
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  field: string;         // 目标字段 key
  message?: string;      // 校验失败提示
}

/** tabs/steps 容器的单个面板（标签页 / 步骤） */
export interface WorkflowFormFieldPane {
  title: string;
  fields: WorkflowFormField[];
}

/** 级联选择（cascader）树形选项节点 */
export interface WorkflowFormCascaderNode {
  value: string;
  label?: string;        // 显示文案，缺省取 value
  children?: WorkflowFormCascaderNode[];
}

// 表单字段配置
export interface WorkflowFormField {
  key: string;
  label: string;
  type: WorkflowFormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;               // 帮助提示（label 下方/旁边的说明）
  options?: string[];              // select/multiSelect 的选项（值列表，作为规范数据源）
  optionItems?: WorkflowFormFieldOptionItem[];  // 增强选项（value/label/颜色/禁用）；与 options 并存，options 始终镜像其 value
  allowOther?: boolean;            // select/radio：允许填写「其他」自定义值
  defaultValue?: unknown;
  visibilityCondition?: WorkflowFieldVisibilityCondition;
  visibilityRules?: WorkflowFieldVisibilityRuleGroup;   // 高级联动：多条件 and/or 显隐
  requiredRules?: WorkflowFieldVisibilityRuleGroup;     // 条件必填：满足规则时必填
  readOnlyRules?: WorkflowFieldVisibilityRuleGroup;     // 条件只读：满足规则时只读
  children?: WorkflowFormField[];  // 明细子字段
  precision?: number;              // 数字/金额精度
  step?: number;                   // 数字步长
  unit?: string;                   // 数字/金额单位（如 "元" "天" "件"）
  currency?: string;               // 金额币种
  amountInWords?: boolean;         // 金额字段：联动显示人民币中文大写
  dateFormat?: string;             // 日期格式
  maxCount?: number;               // 附件/图片限制数
  description?: string;            // 说明文字内容
  serialPrefix?: string;           // 流水号前缀
  rateMax?: number;                // 评分上限（默认 5）
  formula?: string;                // 公式表达式，如 "{amount} * {days}"
  defaultFormula?: string;         // 默认值公式：表单初始渲染时按各字段默认值求值一次（如 "{price}*{qty}"、CONCAT）
  validationFormula?: string;      // 自定义校验公式：求值结果为真通过（如 "{end} > {start}"）
  validationMessage?: string;      // 校验公式失败时的提示文案
  detailSummary?: boolean;         // 明细子列：是否在底部显示合计
  detailColumnWidth?: number;      // 明细子列：列宽（px，缺省自动均分）
  // 校验规则
  minLength?: number;              // 文本最小长度
  maxLength?: number;              // 文本最大长度
  min?: number;                    // 数字/金额最小值
  max?: number;                    // 数字/金额最大值
  pattern?: string;                // 正则表达式
  patternMessage?: string;         // 正则不匹配时的提示
  unique?: boolean;                // 唯一性校验：明细列内行级查重（标量字段则标记，供提交时校验）
  compareRules?: WorkflowFormFieldCompareRule[];  // 跨字段比较校验（number/amount/date）
  dateLimit?: 'none' | 'noPast' | 'noFuture' | 'custom';  // 日期可选范围模式（date/dateRange）
  minDate?: string;                // dateLimit='custom' 时最早可选日期（YYYY-MM-DD）
  maxDate?: string;                // dateLimit='custom' 时最晚可选日期（YYYY-MM-DD）
  accept?: string;                 // 附件/图片允许的文件类型（如 '.pdf,.docx,image/*'）
  maxSize?: number;                // 附件/图片单文件大小上限（MB）
  // 字段联动
  daysFromKey?: string;            // 数字字段：从指定 dateRange 字段自动计算天数
  optionsFrom?: {                  // select/multiSelect：依据父字段值动态生成选项
    sourceKey: string;             // 父字段 key
    mapping: Record<string, string[]>; // 父值 -> 子选项数组
  };
  autoFill?: {                     // select：选中某选项时自动填充其它字段
    targets: string[];             // 受控目标字段 key 列表
    byOption: Record<string, Record<string, string>>; // 选项值 -> { 目标key: 填充值 }（静态映射模式）
    dataSourceFieldMap?: Record<string, string>;      // 目标key -> 数据源记录字段名（远程数据源模式，选中后按记录回填）
  };
  dataSourceId?: number;           // select：选项来自登记的远程数据源（设置后忽略静态 options）
  // Layout fields
  columns?: WorkflowFormFieldColumn[];  // for 'row' type
  panes?: WorkflowFormFieldPane[];      // for 'tabs' / 'steps' type（标签页 / 分步面板）
  title?: string;                       // for 'group' type header
  collapsible?: boolean;                // group：是否可折叠
  defaultCollapsed?: boolean;           // group：默认折叠
  // 响应式列宽（飞书风格自动并排）：24=整行, 12=半列, 8=三分之一, 6=四分之一
  columnSpan?: number;
  // 字段状态
  readOnly?: boolean;                   // 只读（展示但不可编辑）
  hidden?: boolean;                     // 默认隐藏
  // 类型特定
  timeFormat?: string;                  // time 字段时间格式（默认 HH:mm）
  regionLevel?: 'province' | 'city' | 'district';  // region 字段选择层级深度
  // 系统集成选择器（userSelect/deptSelect/dictSelect）
  dictCode?: string;                    // dictSelect：绑定的数据字典 code
  multiple?: boolean;                   // userSelect/deptSelect/dictSelect：是否允许多选
  // relation 关联审批单
  relationDefinitionId?: number;        // 关联的目标流程定义 id（为空则可关联任意流程）
  relationDisplayField?: string;        // 关联记录展示用的表单字段 key（默认显示标题）
  // slider 滑块
  sliderMarks?: boolean;                // 是否显示刻度标记
  // cascader 级联选择
  cascaderOptions?: WorkflowFormCascaderNode[];  // 树形选项
  cascaderChangeOnSelect?: boolean;              // 允许选中任意层级（默认仅叶子可选）
  // nps 量表
  npsMinLabel?: string;                 // 左端说明（如「完全不推荐」）
  npsMaxLabel?: string;                 // 右端说明（如「强烈推荐」）
  // matrix 矩阵量表
  matrixRows?: string[];                // 行（题目）列表
  matrixColumns?: string[];             // 列（选项）列表，各行共用
  // colorPicker 颜色选择器
  alpha?: boolean;                      // 是否支持透明度（rgba）
  // 字段级标签设置（覆盖表单级 settings）
  labelPosition?: 'top' | 'left' | 'inset';   // 字段级标签位置
  labelAlign?: 'left' | 'right';               // 字段级标签对齐
  labelWidth?: number;                          // 字段级标签宽度
}

// ─── 表单库 ─────────────────────────────────────────────────────────────────

/** 表单级设置 */
export interface WorkflowFormSettings {
  description?: string;                 // 表单顶部说明
  submitButtonText?: string;            // 提交按钮文案
  labelPosition?: 'top' | 'left' | 'inset';  // 标签位置
  labelAlign?: 'left' | 'right';        // 标签对齐方式
  labelWidth?: number;                  // 左侧标签宽度（labelPosition='left'/'inset' 时）
}

/** 表单 schema：字段 + 表单级设置 */
export interface WorkflowFormSchema {
  fields: WorkflowFormField[];
  settings?: WorkflowFormSettings;
}

export type WorkflowFormStatus = 'enabled' | 'disabled';

/** 表单远程数据源（登记式外部接口，供 select 字段拉取选项） */
export interface WorkflowDataSource {
  id: number;
  name: string;
  method: 'GET' | 'POST';
  url: string;
  /** 附加请求头（服务端 AES-256-GCM 加密存储；API 返回时值统一脱敏为 ******，更新时传 ****** 表示沿用旧值） */
  headers?: Record<string, string> | null;
  itemsPath?: string | null;
  valueField: string;
  labelField: string;
  keywordParam?: string | null;
  status: 'enabled' | 'disabled';
  remark?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 远程数据源返回的选项 */
export interface WorkflowDataSourceOption {
  value: string;
  label: string;
}

// ── 流程连接器 ──
export type WorkflowConnectorType = 'http' | 'webhook' | 'email' | 'sms' | 'wecom' | 'dingtalk' | 'feishu' | 'mq' | 'database';

export type WorkflowConnectorBreakerState = 'closed' | 'open' | 'halfOpen';

/** HTTP 连接器调用配置（存于 connector.config） */
export interface WorkflowConnectorHttpConfig {
  baseUrl: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  query?: Record<string, string>;
  contentType?: 'json' | 'form';
  authType?: 'none' | 'bearer' | 'basic' | 'apiKey';
  /** apiKey 模式：放入请求头的键名（默认 X-API-Key） */
  apiKeyHeader?: string;
}

/** 连接器凭据明文（落库前整体 AES 加密，绝不回传） */
export interface WorkflowConnectorCredentials {
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
}

export interface WorkflowConnector {
  id: number;
  name: string;
  code: string;
  description: string | null;
  type: WorkflowConnectorType;
  config: Record<string, unknown>;
  timeoutMs: number;
  retryMax: number;
  circuitBreakerEnabled: boolean;
  failureThreshold: number;
  cooldownSec: number;
  /** 限流开关（与熔断并列） */
  rateLimitEnabled: boolean;
  /** 限流：滑动时间窗（秒） */
  rateLimitWindowSec: number;
  /** 限流：窗口内最大调用次数（<=0 不限制） */
  rateLimitMax: number;
  status: 'enabled' | 'disabled';
  /** 是否已配置凭据（脱敏，不回传明文） */
  hasCredentials: boolean;
  /** 熔断实时状态（来自 Redis） */
  breakerState: WorkflowConnectorBreakerState;
  tenantId: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 连接器调用 / 测试结果 */
export interface WorkflowConnectorInvokeResult {
  ok: boolean;
  /** HTTP 状态码（网络层失败为 null） */
  status: number | null;
  durationMs: number;
  /** 截断的响应体（测试用） */
  responseSnippet: string | null;
  error: string | null;
}

export type WorkflowConnectorInvocationSource = 'test' | 'trigger' | 'external' | 'webhook' | 'manual';

/** 连接器调用统计（按时间窗聚合） */
export interface WorkflowConnectorStats {
  connectorId: number;
  windowDays: number;
  total: number;
  success: number;
  failed: number;
  /** 成功率 0~1 */
  successRate: number;
  avgDurationMs: number;
}

/** 连接器单次调用记录 */
export interface WorkflowConnectorInvocation {
  id: number;
  source: WorkflowConnectorInvocationSource;
  ok: boolean;
  status: number | null;
  durationMs: number;
  requestUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** 表单库实体 */
export interface WorkflowForm {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  schema: WorkflowFormSchema | null;
  status: WorkflowFormStatus;
  /** 乐观锁版本号（每次更新 +1，更新时回传 expectedRevision 做并发冲突检测） */
  revision: number;
  /** 被多少个流程定义引用（列表场景返回） */
  usageCount?: number;
  tenantId: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 自定义业务表单暴露给流程的变量声明（驱动条件分支 / 按字段指定审批人） */
export interface WorkflowCustomFormVariable {
  /** 前端渲染用唯一标识（不持久化） */
  id?: string;
  /** 变量 key（业务页提交时写入 formData 的字段名） */
  key: string;
  /** 显示名称 */
  label: string;
  /** 变量类型 */
  type: 'string' | 'number' | 'boolean' | 'date' | 'user' | 'dept';
}

/** 自定义业务表单 / 业务系统主导流程配置（formType='custom' 或 'external' 时有效） */
export interface WorkflowCustomFormConfig {
  /** 创建/填写页组件路径（相对 packages/web/src/pages，如 'biz/leave/LeaveForm'；external 可为空） */
  createComponent: string;
  /** 查看页组件路径，缺省时复用 createComponent 以只读模式渲染 */
  viewComponent?: string | null;
  /** 多页签图标（lucide 图标名，预留给整页打开时使用） */
  icon?: string | null;
  /** 暴露给流程的变量声明 */
  variables?: WorkflowCustomFormVariable[];
}

/** 实例发起时冻结的表单快照 */
export interface WorkflowInstanceFormSnapshot {
  formType?: WorkflowFormType;
  formId?: number | null;
  formName?: string | null;
  fields: WorkflowFormField[];
  settings?: WorkflowFormSettings | null;
  customForm?: WorkflowCustomFormConfig | null;
}

/** 实例发起时冻结的流程定义快照（详情渲染优先使用，避免定义后续修改影响历史实例） */
export interface WorkflowDefinitionSnapshot {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  flowData: WorkflowFlowData | null;
  formId: number | null;
  formName?: string | null;
  formFields?: WorkflowFormField[] | null;
  formSettings?: WorkflowFormSettings | null;
  formType: WorkflowFormType;
  customForm: WorkflowCustomFormConfig | null;
  status?: WorkflowDefinitionStatus;
  version?: number;
  tenantId?: number | null;
}

export interface WorkflowDefinition {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  /** 发起人范围：all=全员, users=指定用户, departments=指定部门, roles=指定角色 */
  initiatorScopeType: 'all' | 'users' | 'departments' | 'roles';
  /** 发起人范围 ID 列表（当 initiatorScopeType !== 'all' 时生效） */
  initiatorScopeIds: number[] | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  flowData: WorkflowFlowData | null;
  /** 绑定的表单 ID（实时引用最新表单） */
  formId: number | null;
  formName?: string | null;
  /** 由 formId 解析得到的表单字段（派生字段，设计/发起时使用最新表单内容） */
  formFields: WorkflowFormField[] | null;
  /** 由 formId 解析得到的表单级设置（派生字段） */
  formSettings?: WorkflowFormSettings | null;
  /** 表单类型：designer=表单库，custom=自定义业务页面，external=业务系统主导 */
  formType: WorkflowFormType;
  /** 自定义业务表单配置（formType='custom' 或 'external' 时有效） */
  customForm: WorkflowCustomFormConfig | null;
  status: WorkflowDefinitionStatus;
  version: number;
  tenantId: number | null;
  createdBy: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCategory {
  id: number;
  name: string;
  code: string | null;
  icon: string | null;
  color: string | null;
  sort: number;
  description: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionVersion {
  id: number;
  definitionId: number;
  version: number;
  name: string;
  description: string | null;
  flowData: WorkflowFlowData | null;
  formId: number | null;
  formName?: string | null;
  formFields: WorkflowFormField[] | null;
  formType: WorkflowFormType;
  customForm: WorkflowCustomFormConfig | null;
  publishedAt: string;
  publishedBy: number | null;
  publishedByName?: string | null;
  tenantId: number | null;
}

export type WorkflowAutomationTrigger = 'approved' | 'rejected' | 'withdrawn' | 'created';

export interface WorkflowAutomationActionStartWorkflow {
  type: 'startWorkflow';
  definitionId: number;
  titleTemplate?: string;
  formMapping?: Record<string, string>;
}

export interface WorkflowAutomationActionSendMessage {
  type: 'sendMessage';
  title: string;
  content: string;
  messageType?: 'info' | 'success' | 'warning' | 'error';
  recipients?: 'initiator' | { userIds: number[] };
  buttons?: Array<{ text: string; url: string }>;
}

export interface WorkflowAutomationActionWebhook {
  type: 'webhook';
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

export interface WorkflowAutomationActionUpdateField {
  type: 'updateField';
  fields: Record<string, string>;
}

export type WorkflowAutomationAction =
  | WorkflowAutomationActionStartWorkflow
  | WorkflowAutomationActionSendMessage
  | WorkflowAutomationActionWebhook
  | WorkflowAutomationActionUpdateField;

export interface WorkflowAutomation {
  id: number;
  definitionId: number;
  definitionName?: string | null;
  name: string;
  trigger: WorkflowAutomationTrigger;
  actions: WorkflowAutomationAction[];
  status: 'enabled' | 'disabled';
  sort: number;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 流程定时发起规则 */
export interface WorkflowSchedule {
  id: number;
  definitionId: number;
  definitionName?: string | null;
  name: string;
  cronExpression: string;
  /** IANA 时区（如 Asia/Shanghai）；null = 默认 Asia/Shanghai */
  timezone: string | null;
  initiatorId: number;
  initiatorName?: string | null;
  titleTemplate: string | null;
  formData: Record<string, unknown> | null;
  status: 'enabled' | 'disabled';
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  nextRunAt: string | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 列表保存视图 */
export interface WorkflowSavedView {
  id: number;
  userId: number;
  pageKey: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 提交前审批链路预览节点 */
export interface WorkflowApproverPreviewNode {
  nodeKey: string;
  nodeName: string;
  nodeType: WorkflowNodeType | string;
  /** 解析出的处理人（已转换为真实姓名） */
  approvers: Array<{ id: number; name: string }>;
  /** 发起人/审批人自选节点的可选候选人 */
  selectableApprovers?: Array<{ id: number; name: string }>;
  /** 自选审批人选择是否必填 */
  selectionRequired?: boolean;
  /** 多人审批方式（and/or/sequential/ratio） */
  approveMethod?: string | null;
  /** 所在分支标签（条件/并行分支时） */
  branchLabel?: string | null;
  /** 审批人为空（需按节点空处理策略兜底） */
  empty?: boolean;
}

/**
 * 审批时「下一节点审批人自选」的候选分组：
 * 每个紧邻的下一 approverSelect 节点一组，候选人已按节点配置的范围（成员/角色/部门/用户组）在服务端解析收窄。
 */
export interface WorkflowSelectableNextApproverGroup {
  /** approverSelect 节点 key */
  nodeKey: string;
  /** 节点显示名 */
  label: string;
  /** 该节点可供当前审批人挑选的候选人（已按 selectScope 收窄） */
  selectableApprovers: Array<{ id: number; name: string }>;
}

/** 流程仿真中对指定节点预设的处理动作 */
export interface WorkflowSimulationDecision {
  nodeKey: string;
  action: 'approve' | 'reject' | 'skip' | 'wait';
  assigneeId?: number;
  reason?: string;
  formPatch?: Record<string, unknown>;
}

/** 已保存的仿真用例（测试场景：表单数据 + 决策 + 发起人，按定义归档，供回归仿真复用） */
export interface WorkflowSimulationCase {
  id: number;
  definitionId: number;
  name: string;
  starterUserId: number | null;
  formData: Record<string, unknown>;
  decisions: WorkflowSimulationDecision[];
  tenantId: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 流程仿真选项 */
export interface WorkflowSimulationOptions {
  maxSteps?: number;
  mockDelay?: boolean;
  mockTrigger?: boolean;
  expandSubProcess?: boolean;
}

export type WorkflowSimulationResultStatus = 'finished' | 'rejected' | 'waiting' | 'blocked' | 'invalid' | 'stepLimit';

export type WorkflowSimulationTimelineStatus = 'entered' | 'waiting' | 'approved' | 'rejected' | 'autoApproved' | 'skipped' | 'blocked';

export type WorkflowSimulationNodeStateStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export type WorkflowSimulationHealthLevel = 'error' | 'warning' | 'info';

/** 流程仿真时间线节点 */
export interface WorkflowSimulationTimelineItem {
  step: number;
  nodeKey: string;
  nodeName: string;
  nodeType: WorkflowNodeType | string;
  status: WorkflowSimulationTimelineStatus;
  assignees?: Array<{ id: number; name: string }>;
  decision?: 'approve' | 'reject' | 'skip' | 'wait' | 'auto';
  reason?: string;
  detail?: string;
  nextNodeKeys?: string[];
  /** 该步骤预估耗时（分钟），自动/瞬时节点为 0 */
  estimatedMinutes?: number;
}

/** 流程仿真连线命中结果 */
export interface WorkflowSimulationEdgeResult {
  edgeId: string;
  source: string;
  target: string;
  sourceKey?: string;
  targetKey?: string;
  label?: string | null;
  taken: boolean;
  reason?: string;
  conditionMatched?: boolean | null;
  conditionSummary?: string | null;
  actualValue?: string | null;
}

/** 流程仿真节点状态 */
export interface WorkflowSimulationNodeState {
  status: WorkflowSimulationNodeStateStatus;
  message?: string;
}

/** 流程仿真体检问题 */
export interface WorkflowSimulationHealthIssue {
  level: WorkflowSimulationHealthLevel;
  scope: 'flow' | 'node' | 'edge';
  nodeKey?: string;
  edgeId?: string;
  message: string;
  suggestion?: string;
}

/** 流程仿真阻塞点（人工审批 / 延时 / 外部回调 / 子流程 / 死锁） */
export interface WorkflowSimulationBlockingPoint {
  nodeKey: string;
  nodeName: string;
  kind: 'humanTask' | 'delay' | 'external' | 'subProcess' | 'blocked';
  reason: string;
  /** 该阻塞点预估等待时长（分钟） */
  estimatedMinutes: number;
}

/** 流程仿真结果 */
export interface WorkflowSimulationResult {
  valid: boolean;
  warnings: string[];
  result: WorkflowSimulationResultStatus;
  timeline: WorkflowSimulationTimelineItem[];
  edgeResults: WorkflowSimulationEdgeResult[];
  nodeStates: Record<string, WorkflowSimulationNodeState>;
  healthIssues: WorkflowSimulationHealthIssue[];
  pathSignature: string[];
  /** 路径预估总耗时（分钟，各步骤累加） */
  estimatedDurationMinutes: number;
  /** 阻塞点汇总 */
  blockingPoints: WorkflowSimulationBlockingPoint[];
}

/** 关联审批单可选项（relation 字段检索结果） */
export interface WorkflowRelationOption {
  instanceId: number;
  title: string;
  serialNo: string | null;
  definitionName: string | null;
  status: WorkflowInstanceStatus;
  createdAt: string;
}

export interface WorkflowTask {
  id: number;
  instanceId: number;
  nodeKey: string;
  nodeName: string;
  nodeType: WorkflowNodeType | null;
  assigneeId: number | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  status: WorkflowTaskStatus;
  comment: string | null;
  /** 手写签名（data URL / 图片地址） */
  signature?: string | null;
  /** 审批附件（审批通过时上传，{name,url,size}[]） */
  attachments?: Array<{ name: string; url: string; size?: number }>;
  /** 该任务所属节点是否要求手写签名（派生字段，由节点 operations 计算） */
  signatureRequired?: boolean;
  actionAt: string | null;
  /** 任务原始处理人（创建时快照，转办/委派不会修改） */
  originalAssigneeId?: number | null;
  /** 转办明细（详情场景填充：转办/委派/改派/交接/超时升级留痕，含双方与操作人姓名） */
  transfers?: WorkflowTaskTransfer[] | null;
  /** 委派来源（仅委派期间设置；回执任务为 null） */
  delegatedFromId?: number | null;
  /** 外部审批回调 ID（task.status='waiting' + externalApproval 启用时生效；派发/恢复由 workflow_jobs 接管） */
  externalCallbackId?: string | null;
  /** 当前节点配置中的操作按钮设置（仅审批节点） */
  actionButtons?: Partial<Record<WorkflowActionButtonKey, WorkflowActionButtonConfig>> | null;
  createdAt: string;
}

export interface WorkflowTaskUrge {
  id: number;
  taskId: number;
  instanceId: number;
  urgerId: number | null;
  urgerName: string | null;
  message: string | null;
  createdAt: string;
}

export type WorkflowInstancePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface WorkflowInstance {
  id: number;
  definitionId: number;
  definitionName?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  title: string;
  /** 业务编号/流水号（按流程定义编号规则在发起时生成） */
  serialNo?: string | null;
  /** 加急/优先级 */
  priority?: WorkflowInstancePriority;
  /** 是否允许发起人撤回（来自流程定义高级设置，运行中申请用于控制撤回按钮） */
  allowWithdraw?: boolean;
  /** 是否允许驳回后重新提交（来自流程定义高级设置，列表/详情用于控制按钮） */
  allowResubmit?: boolean;
  /** 是否允许流程中评论（来自流程定义高级设置） */
  allowComment?: boolean;
  formData: Record<string, unknown> | null;
  /** 发起时的表单结构快照（冻结历史，渲染只读/审批表单时使用） */
  formSnapshot?: WorkflowInstanceFormSnapshot | null;
  /** 发起时的流程定义快照（详情场景返回） */
  definitionSnapshot?: WorkflowDefinitionSnapshot | null;
  status: WorkflowInstanceStatus;
  currentNodeKey: string | null;
  /** 当前所有活动节点 key（并行分支可能有多个；未提供时兼容 currentNodeKey） */
  currentNodeKeys?: string[];
  /** 当前所处节点名称（由流程快照解析，仅列表/监控场景填充） */
  currentNodeName?: string | null;
  /** 当前所有活动节点名称（并行分支可能有多个） */
  currentNodeNames?: string[];
  initiatorId: number;
  initiatorName?: string | null;
  initiatorAvatar?: string | null;
  tenantId: number | null;
  /** 子流程：父实例 ID（本实例由父实例 subProcess 节点发起时填充） */
  parentInstanceId?: number | null;
  /** 子流程：父实例中触发本子流程的任务 ID */
  parentTaskId?: number | null;
  /** 子流程多实例：父任务下循环项幂等 key */
  parentTaskItemKey?: string | null;
  /** 子流程多实例：父任务下循环项序号（0-based） */
  parentTaskItemIndex?: number | null;
  /** 业务实体接入：业务类型（如 biz_leave），普通流程为空 */
  bizType?: string | null;
  /** 业务实体接入：业务记录主键（与 bizType 组成 businessKey） */
  bizId?: string | null;
  /** 挂起时间（status=suspended 时有值） */
  suspendedAt?: string | null;
  /** 挂起原因 */
  suspendReason?: string | null;
  /** 子流程：本实例发起的子实例摘要列表（仅详情场景填充） */
  childInstances?: WorkflowChildInstanceSummary[] | null;
  tasks?: WorkflowTask[];
  /** 沟通评论（仅详情场景填充） */
  comments?: WorkflowComment[];
  /** 协办意见（仅详情场景填充） */
  consults?: WorkflowTaskConsult[];
  /** 已办视图：我在该实例处理过的任务状态（approved/rejected/...） */
  myTaskStatus?: WorkflowTaskStatus | null;
  /** 已办视图：我处理的时间 */
  myActionAt?: string | null;
  /** 抄送视图：抄送给我的任务 ID */
  ccTaskId?: number | null;
  /** 抄送视图：已读时间（null=未读） */
  ccReadAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 流程评论 / 沟通时间线条目 */
export interface WorkflowComment {
  id: number;
  instanceId: number;
  taskId?: number | null;
  /** 回复引用的父评论 ID（一层引用） */
  parentId?: number | null;
  /** 父评论摘要（展示引用块用：作者 + 内容截断） */
  parentSummary?: { userName: string | null; content: string } | null;
  userId: number;
  userName?: string | null;
  userAvatar?: string | null;
  content: string;
  /** @ 提及的用户 ID */
  mentions: number[];
  /** @ 提及的用户名（展示用） */
  mentionNames?: string[] | null;
  attachments: Array<{ name: string; url: string; size?: number }>;
  createdAt: string;
}

/** 审批意见常用语 */
export interface WorkflowQuickPhrase {
  id: number;
  /** null = 系统预置（所有人可见） */
  userId: number | null;
  content: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 流程模板 */
export interface WorkflowTemplate {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  categoryName: string | null;
  icon: string | null;
  color: string | null;
  flowData: WorkflowFlowData | null;
  formSchema: WorkflowFormSchema | null;
  sort: number;
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 审批协办状态 */
export type WorkflowTaskConsultStatus = 'pending' | 'replied' | 'revoked';

/** 审批协办 / 邀请处理意见 */
export interface WorkflowTaskConsult {
  id: number;
  taskId: number;
  instanceId: number;
  nodeName?: string | null;
  inviterId: number;
  inviterName?: string | null;
  consulteeId: number;
  consulteeName?: string | null;
  consulteeAvatar?: string | null;
  question: string | null;
  opinion: string | null;
  status: WorkflowTaskConsultStatus;
  repliedAt?: string | null;
  createdAt: string;
}

/** 审批代理 / 离岗委托规则 */
export interface WorkflowDelegation {
  id: number;
  principalId: number;
  principalName?: string | null;
  delegateId: number;
  delegateName?: string | null;
  /** null = 对全部流程生效 */
  definitionId: number | null;
  definitionName?: string | null;
  reason?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  enabled: boolean;
  /** 当前是否处于生效区间（由后端计算） */
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 流程数据分析 ─────────────────────────────────────────────────────────────
export interface WorkflowAnalyticsStatusCount {
  status: WorkflowInstanceStatus;
  count: number;
}

export interface WorkflowAnalyticsDefinitionStat {
  definitionId: number;
  definitionName: string;
  total: number;
  running: number;
  approved: number;
  rejected: number;
  /** 已完结实例的平均耗时（秒） */
  avgDurationSec: number | null;
}

export interface WorkflowAnalyticsNodeBottleneck {
  definitionId: number;
  definitionName: string;
  nodeKey: string;
  nodeName: string;
  /** 该节点已完成任务的平均处理时长（秒） */
  avgHandleSec: number | null;
  /** 当前仍挂起的任务数 */
  pendingCount: number;
  /** 已完成任务数 */
  doneCount: number;
}

export interface WorkflowAnalyticsApproverWorkload {
  userId: number;
  userName: string;
  pendingCount: number;
  /** 已处理任务数（已通过 + 已驳回） */
  handledCount: number;
  /** 最早待办的等待时长（秒） */
  oldestPendingSec: number | null;
}

export interface WorkflowAnalyticsTrendPoint {
  date: string;
  created: number;
  completed: number;
  /** 当日积压（运行中实例估算，按 created-completed 累计回推） */
  pending?: number;
}

export interface WorkflowAnalytics {
  statusCounts: WorkflowAnalyticsStatusCount[];
  total: number;
  /** 全部已完结实例平均耗时（秒） */
  avgDurationSec: number | null;
  /** 当前挂起任务总数 */
  pendingTaskCount: number;
  /** 已超时（timeoutAt < now）仍挂起的任务数 */
  overdueTaskCount: number;
  /** 即将超时（24h 内到期）的挂起任务数 */
  dueSoonTaskCount: number;
  /** 近 7 天发起数 */
  recentCreated: number;
  /** 驳回率：已驳回实例 / (已通过 + 已驳回)，0-1，无已决实例时为 null */
  rejectionRate: number | null;
  /** 超时率：已超时待办 / 当前待办，0-1，无待办时为 null */
  timeoutRate: number | null;
  definitionStats: WorkflowAnalyticsDefinitionStat[];
  nodeBottlenecks: WorkflowAnalyticsNodeBottleneck[];
  approverWorkloads: WorkflowAnalyticsApproverWorkload[];
  automation: {
    jobsTotal: number; jobsFailed: number; jobsDead: number; jobFailRate: number | null;
    webhookTotal: number; webhookSuccessRate: number | null;
    subprocessTotal: number; subprocessFailRate: number | null;
  };
  trend: WorkflowAnalyticsTrendPoint[];
}

/** 超时待办预警条目 */
export interface WorkflowOverdueTask {
  taskId: number;
  instanceId: number;
  instanceTitle: string;
  serialNo?: string | null;
  definitionName: string;
  nodeName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  timeoutAt: string;
  /** 已超时秒数（正数=已超时；负数=距到期剩余） */
  overdueSec: number;
}

/** 批量审批结果（逐条返回成功/失败） */
export interface WorkflowBatchActionResult {
  taskId: number;
  success: boolean;
  message?: string;
}

/** 实例级批量操作结果（批量撤回/批量催办） */
export interface WorkflowInstanceBatchActionResult {
  instanceId: number;
  success: boolean;
  message?: string;
}

/** 批量恢复结果汇总（批量推进卡死实例等运营恢复动作） */
export interface WorkflowRecoveryBatchResult {
  /** 命中的候选数量 */
  total: number;
  /** 成功恢复数量 */
  success: number;
  /** 失败数量（按候选逐个隔离，失败不影响其它） */
  failed: number;
}

/** 子流程子实例摘要（用于父实例详情展示与跳转） */
export interface WorkflowChildInstanceSummary {
  id: number;
  title: string;
  status: WorkflowInstanceStatus;
  /** 触发该子实例的父任务节点 key */
  parentTaskNodeKey?: string | null;
  createdAt: string;
}

// ─── 流程事件总线 ─────────────────────────────────────────────────────────────
export type WorkflowEventType =
  | 'instance.created'
  | 'instance.approved'
  | 'instance.rejected'
  | 'instance.withdrawn'
  | 'node.entered'
  | 'node.left'
  | 'task.created'
  | 'task.assigned'
  | 'task.approved'
  | 'task.rejected'
  | 'task.skipped'
  | 'task.transferred'
  | 'task.addSigned'
  | 'task.reduceSigned'
  | 'task.urged';

export interface WorkflowEventActor {
  userId: number;
  name?: string | null;
}

export interface WorkflowEventBase {
  /** 唯一事件 ID（uuid），用于外部系统幂等 */
  eventId: string;
  type: WorkflowEventType;
  /** ISO 时间戳（YYYY-MM-DD HH:mm:ss） */
  occurredAt: string;
  instanceId: number;
  definitionId: number;
  tenantId: number | null;
  actor?: WorkflowEventActor;
}

export interface WorkflowInstanceEventPayload extends WorkflowEventBase {
  type: 'instance.created' | 'instance.approved' | 'instance.rejected' | 'instance.withdrawn';
  instance: WorkflowInstance;
}

export interface WorkflowNodeEventPayload extends WorkflowEventBase {
  type: 'node.entered' | 'node.left';
  nodeKey: string;
  nodeName: string;
  nodeType: WorkflowNodeType | null;
}

export interface WorkflowTaskEventPayload extends WorkflowEventBase {
  type: 'task.created' | 'task.assigned' | 'task.approved' | 'task.rejected' | 'task.skipped' | 'task.transferred' | 'task.addSigned' | 'task.reduceSigned' | 'task.urged';
  task: WorkflowTask;
  comment?: string | null;
}

export type WorkflowEvent =
  | WorkflowInstanceEventPayload
  | WorkflowNodeEventPayload
  | WorkflowTaskEventPayload;

export type WorkflowEventSignMode = 'hmacSha256' | 'none';

export type WorkflowEventDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WorkflowEventSubscription {
  id: number;
  name: string;
  description: string | null;
  /** null = 全局（订阅所有流程定义） */
  definitionId: number | null;
  definitionName?: string | null;
  events: WorkflowEventType[];
  url: string;
  /** 列表/详情只返回脱敏值；明文通过 secret 专用接口按需获取 */
  secretMasked: string | null;
  signMode: WorkflowEventSignMode;
  headers: Record<string, string> | null;
  /** 经连接器投递：引用 http 连接器 id（设置后 url 退化为相对路径） */
  connectorId: number | null;
  enabled: boolean;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEventDelivery {
  id: number;
  subscriptionId: number;
  subscriptionName?: string | null;
  instanceId: number | null;
  taskId: number | null;
  eventId: string;
  eventType: WorkflowEventType;
  payload: WorkflowEvent | null;
  attempt: number;
  status: WorkflowEventDeliveryStatus;
  requestUrl: string | null;
  requestHeaders: Record<string, string> | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  nextRetryAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  tenantId: number | null;
  createdAt: string;
}

// ─── 触发器节点执行 ──────────────────────────────────────────────────────────
export type WorkflowTriggerExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'retrying';

export type WorkflowTriggerType = 'webhook' | 'callback' | 'updateData' | 'deleteData';

export interface WorkflowTriggerExecution {
  id: number;
  instanceId: number;
  taskId: number | null;
  nodeKey: string;
  nodeName: string | null;
  triggerType: WorkflowTriggerType;
  status: WorkflowTriggerExecutionStatus;
  attempt: number;
  requestUrl: string | null;
  requestMethod: string | null;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  tenantId: number | null;
  createdAt: string;
}

// ─── 统一作业账本（workflow_jobs）────────────────────────────────────────────
export type WorkflowJobType =
  | 'delay_wake' | 'task_timeout' | 'trigger_dispatch' | 'external_dispatch'
  | 'subprocess_spawn' | 'subprocess_join' | 'event_dispatch' | 'webhook_delivery'
  | 'compensation_action';

export type WorkflowJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead' | 'canceled';

export type WorkflowJobExecutionStatus = 'running' | 'succeeded' | 'failed';

export interface WorkflowJob {
  id: number;
  jobType: WorkflowJobType;
  status: WorkflowJobStatus;
  instanceId: number | null;
  instanceTitle: string | null;
  definitionName: string | null;
  taskId: number | null;
  nodeKey: string | null;
  idempotencyKey: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  result: Record<string, unknown> | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowJobExecution {
  id: number;
  jobId: number;
  jobType: WorkflowJobType;
  attempt: number;
  status: WorkflowJobExecutionStatus;
  requestUrl: string | null;
  requestMethod: string | null;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  tenantId: number | null;
  createdAt: string;
}

/** 链路视图：同一 traceId 关联的全部作业（一次操作的完整异步 fan-out）+ 执行明细 + 状态统计 */
export interface WorkflowJobChain {
  traceId: string;
  jobs: (WorkflowJob & { executions: WorkflowJobExecution[] })[];
  stats: {
    total: number;
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    dead: number;
    canceled: number;
    /** 链路涉及的实例 ID（跨实例/子流程时 > 1） */
    instanceIds: number[];
  };
}

/** 按作业类型聚合的状态计数（作业账本 Tab 徽标） */
export interface WorkflowJobSummaryItem {
  jobType: WorkflowJobType;
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  dead: number;
  canceled: number;
}

export interface WorkflowJobBatchResult {
  total: number;
  success: number;
  skipped: number;
}

/** 待办 SLA 紧急度：none=未配置超时, safe=充裕, warning=临近, overdue=已超时 */
export type WorkflowSlaLevel = 'none' | 'safe' | 'warning' | 'overdue';

// ─── 发布前健康评分 / 分支覆盖分析 ──────────────────────────────────────────
export type WorkflowDefinitionHealthSeverity = 'info' | 'warning' | 'critical';

export interface WorkflowDefinitionHealthIssue {
  severity: WorkflowDefinitionHealthSeverity;
  message: string;
  suggestion: string | null;
  nodeKey: string | null;
  nodeName: string | null;
}

export interface WorkflowDefinitionHealthCheckItem {
  key: 'structure' | 'approver' | 'branch' | 'timeout' | 'expression';
  title: string;
  status: 'pass' | 'warn' | 'fail';
  /** 该维度得分 0-100 */
  score: number;
  /** 该维度在总分中的权重 0-1 */
  weight: number;
  summary: string;
  issues: WorkflowDefinitionHealthIssue[];
}

/** 单个网关的分支覆盖分析 */
export interface WorkflowDefinitionBranchCoverageItem {
  nodeKey: string;
  nodeName: string;
  nodeType: string;
  branchCount: number;
  hasDefault: boolean;
  issues: WorkflowDefinitionHealthIssue[];
}

export interface WorkflowDefinitionHealthReport {
  /** 总分 0-100（各维度加权） */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  /** 结构是否硬性合法（来自 validateFlowData） */
  valid: boolean;
  checks: WorkflowDefinitionHealthCheckItem[];
  branchCoverage: WorkflowDefinitionBranchCoverageItem[];
  generatedAt: string;
}

// ─── 版本 diff 细化 ─────────────────────────────────────────────────────────
export interface WorkflowVersionDiffSide {
  version: number;
  name: string;
  label: string;
  flowData: WorkflowFlowData | null;
  publishedAt: string | null;
}

export interface WorkflowVersionFieldChange {
  field: string;
  before: string;
  after: string;
}

export interface WorkflowVersionNodeChange {
  kind: 'added' | 'removed' | 'modified';
  nodeKey: string;
  nodeName: string;
  nodeType: string;
  /** modified 时的字段级变更 */
  fields: WorkflowVersionFieldChange[];
}

export interface WorkflowVersionEdgeChange {
  kind: 'added' | 'removed' | 'modified';
  from: string;
  to: string;
  /** 条件摘要变化（modified 时 before/after 均有值） */
  before: string | null;
  after: string | null;
}

export interface WorkflowVersionDiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesModified: number;
}

export interface WorkflowVersionDiff {
  left: WorkflowVersionDiffSide;
  right: WorkflowVersionDiffSide;
  summary: WorkflowVersionDiffSummary;
  nodeChanges: WorkflowVersionNodeChange[];
  edgeChanges: WorkflowVersionEdgeChange[];
}

// ─── 运行轨迹 / 引擎解释（实例可观测性）─────────────────────────────────────
export type WorkflowEngineExplanationState = 'running' | 'blocked' | 'completed' | 'rejected' | 'canceled' | 'withdrawn' | 'draft';

/** 引擎解释：当前实例「为什么停在这里 / 在等谁 / 等什么」的单条阻塞项 */
export interface WorkflowEngineExplanationBlocker {
  kind: 'task' | 'job';
  severity: WorkflowRuntimeIssueSeverity;
  title: string;
  detail: string;
  taskId: number | null;
  jobId: number | null;
  jobType: WorkflowJobType | null;
  nodeName: string | null;
  /** 任务已等待分钟数（task 类阻塞） */
  waitingMinutes: number | null;
  /** 下次重试 / 计划执行时间（job 类阻塞） */
  nextRetryAt: string | null;
}

/** 引擎解释：实例当前运行态的人话总结 */
export interface WorkflowEngineExplanation {
  state: WorkflowEngineExplanationState;
  /** 一句话总结 */
  headline: string;
  /** 阻塞 / 等待项（按严重度排序） */
  blockers: WorkflowEngineExplanationBlocker[];
  /** 最近一次失败描述 */
  lastError: string | null;
  /** 下一个待执行作业的计划时间 */
  nextWakeAt: string | null;
  pendingJobCount: number;
  failedJobCount: number;
}

/** 运行轨迹条目内的单次作业执行尝试 */
export interface WorkflowEngineTraceExecution {
  attempt: number;
  status: WorkflowJobExecutionStatus;
  requestUrl: string | null;
  requestMethod: string | null;
  responseStatus: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  finishedAt: string | null;
}

/** 运行轨迹：合并任务流转 + 异步作业的时间线条目 */
export interface WorkflowEngineTraceEntry {
  key: string;
  kind: 'task' | 'job' | 'token';
  /** 主时间戳（YYYY-MM-DD HH:mm:ss） */
  at: string;
  traceId: string | null;
  title: string;
  status: string;
  nodeName: string | null;
  // task 类
  assigneeName: string | null;
  comment: string | null;
  // job 类
  jobId: number | null;
  jobType: WorkflowJobType | null;
  attempts: number | null;
  maxAttempts: number | null;
  runAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
  executions: WorkflowEngineTraceExecution[];
}

export interface WorkflowInstanceTrace {
  instanceId: number;
  title: string;
  explanation: WorkflowEngineExplanation;
  trace: WorkflowEngineTraceEntry[];
  generatedAt: string;
}

export type WorkflowRuntimeIssueSeverity = 'info' | 'warning' | 'critical';

export interface WorkflowRuntimeIssue {
  severity: WorkflowRuntimeIssueSeverity;
  title: string;
  description: string;
  source: 'instance' | 'task' | 'trigger' | 'outbox' | 'token';
  taskId?: number | null;
  nodeKey?: string | null;
}

export interface WorkflowRuntimeOutboxEvent {
  id: number;
  eventId: string;
  eventType: string;
  taskId: number | null;
  status: string;
  attempts: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

/** 显式执行 Token（活动路径 / 网关汇聚的权威单元，用于运行态可观测/重放） */
export interface WorkflowExecutionToken {
  id: number;
  nodeKey: string;
  nodeName: string | null;
  status: 'active' | 'consumed' | 'dead';
  /** 是否 parked 在网关 join 节点（active 且停在并行/包容汇聚节点，等待兄弟分支） */
  parkedAtJoin: boolean;
  /** 分支栈：每帧 { id: fork 组 id, index: 组内序号, total: 组内分支数 }，空数组=主路径 */
  branchPath: Array<{ id: string; index: number; total: number }>;
  /** 分支深度（branchPath 长度） */
  depth: number;
  /** fork 处被消费的前驱 token（血缘） */
  parentTokenId: number | null;
  /** 子流程/多实例项作用域（如 sub:{父实例}:{父任务}:{循环项}），主流程为 null */
  scopeKey: string | null;
  createdAt: string;
  consumedAt: string | null;
}

/** 实例执行 Token 视图（GET /instances/:id/tokens 与诊断复用） */
export interface WorkflowExecutionTokenView {
  instanceId: number;
  /** 活动 frontier token 数（不含 parked join） */
  activeCount: number;
  /** parked 在 join 的 token 数 */
  parkedCount: number;
  /** 已消费 token 数 */
  consumedCount: number;
  /** 已终止 token 数 */
  deadCount: number;
  tokens: WorkflowExecutionToken[];
  generatedAt: string;
}

export interface WorkflowRuntimeDiagnostics {
  instance: WorkflowInstance;
  tasks: WorkflowTask[];
  activeTasks: WorkflowTask[];
  triggerExecutions: WorkflowTriggerExecution[];
  outboxEvents: WorkflowRuntimeOutboxEvent[];
  issues: WorkflowRuntimeIssue[];
  /** 显式执行 Token 列表（活动路径 + 血缘，按 id 升序） */
  tokens: WorkflowExecutionToken[];
  snapshot: {
    formData: Record<string, unknown> | null;
    formSnapshot: unknown;
    definitionSnapshot: unknown;
  };
  generatedAt: string;
}

export type WorkflowEngineComponentStatus = 'healthy' | 'warning' | 'critical';

export type WorkflowEngineComponentKey =
  | 'dagExecutor'
  | 'taskMaterializer'
  | 'delayScheduler'
  | 'timeoutProcessor'
  | 'triggerDispatcher'
  | 'externalApprover'
  | 'subProcessRecovery'
  | 'eventBus'
  | 'outbox'
  | 'scheduler';

export type WorkflowEngineQueueKey =
  | 'humanTasks'
  | 'delayWakeups'
  | 'timeouts'
  | 'triggerDispatch'
  | 'externalApprovals'
  | 'subProcessJoin'
  | 'eventOutbox';

export interface WorkflowEngineMetric {
  label: string;
  value: number | string;
  unit?: string | null;
  hint?: string | null;
  status?: WorkflowEngineComponentStatus | null;
}

export interface WorkflowEngineComponent {
  key: WorkflowEngineComponentKey;
  name: string;
  status: WorkflowEngineComponentStatus;
  description: string;
  metrics: WorkflowEngineMetric[];
  internals?: Record<string, unknown> | null;
}

export interface WorkflowEngineQueueSnapshot {
  key: WorkflowEngineQueueKey;
  name: string;
  status: WorkflowEngineComponentStatus;
  ready: number;
  running: number;
  delayed: number;
  failed: number;
  oldestAgeMinutes: number | null;
  details?: Record<string, number | string | null> | null;
}

export interface WorkflowEngineDefinitionValidationItem {
  definitionId: number;
  name: string;
  status: WorkflowDefinitionStatus;
  version: number;
  errors: string[];
}

export interface WorkflowEngineDefinitionSnapshot {
  total: number;
  published: number;
  invalid: number;
  invalidPublished: number;
  nodeTypeCounts: Record<string, number>;
  edgeCount: number;
  invalidDefinitions: WorkflowEngineDefinitionValidationItem[];
}

export interface WorkflowEngineEventBusSnapshot {
  totalListenerCount: number;
  listeners: Array<{ eventType: WorkflowEventType | '__any__'; listenerCount: number }>;
}

export interface WorkflowEngineSchedulerSnapshot {
  initialized: boolean;
  runningJobCount: number;
  node: { id: string; hostname: string; pid: number };
  registeredHandlers: string[];
  systemRecurringJobs: Array<SystemSchedulerTaskBase & { taskType: 'recurring'; cronExpression: string }>;
  systemQueueWorkers: Array<SystemSchedulerTaskBase & { taskType: 'queue'; cronExpression: null; allowManualRun: false }>;
  wip: Array<{ name: string; count: number }>;
}

export interface WorkflowEngineRuntimeTask {
  queue: WorkflowEngineQueueKey;
  taskId: number;
  instanceId: number;
  instanceTitle: string;
  serialNo: string | null;
  definitionId: number;
  definitionName: string;
  nodeKey: string;
  nodeName: string;
  nodeType: WorkflowNodeType | null;
  status: WorkflowTaskStatus;
  assigneeId: number | null;
  assigneeName: string | null;
  priority: WorkflowInstancePriority;
  externalCallbackId: string | null;
  externalDispatchStatus: WorkflowTaskExternalDispatchStatus | null;
  triggerDispatchStatus: WorkflowTriggerExecutionStatus | null;
  triggerAttempt: number;
  triggerNextRetryAt: string | null;
  triggerLastError: string | null;
  timeoutAt: string | null;
  wakeAt: string | null;
  ageMinutes: number;
  createdAt: string;
}

export interface WorkflowEngineOutboxEvent {
  id: number;
  eventId: string;
  eventType: string;
  instanceId: number | null;
  instanceTitle: string | null;
  taskId: number | null;
  status: string;
  attempts: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  processedAt: string | null;
  ageMinutes: number;
  createdAt: string;
}

export interface WorkflowEngineTriggerExecution extends WorkflowTriggerExecution {
  instanceTitle: string | null;
}

export interface WorkflowEngineRuntimeIssue {
  id: string;
  severity: WorkflowRuntimeIssueSeverity;
  component: WorkflowEngineComponentKey;
  title: string;
  description: string;
  refType?: 'definition' | 'instance' | 'task' | 'triggerExecution' | 'outbox' | 'scheduler' | null;
  refId?: number | null;
  ageMinutes?: number | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WorkflowEngineRuntimeSnapshot {
  runningInstances: number;
  /** 平台内运行实例的活动执行 Token 总数（in-flight 执行路径） */
  activeTokens: number;
  runningWithoutActiveTasks: Array<{
    instanceId: number;
    title: string;
    serialNo: string | null;
    definitionId: number;
    definitionName: string | null;
    currentNodeKey: string | null;
    ageMinutes: number;
    createdAt: string;
  }>;
  taskQueue: WorkflowEngineRuntimeTask[];
  triggerExecutions: WorkflowEngineTriggerExecution[];
  outboxEvents: WorkflowEngineOutboxEvent[];
}

/** 时间窗口内的事件处理计数（吞吐 / 错误黄金信号） */
export interface WorkflowEngineThroughputWindow {
  total: number;
  success: number;
  failed: number;
}

/** 单个小时桶的事件吞吐（用于近 24h 趋势 sparkline） */
export interface WorkflowEngineEventBucket {
  /** 小时桶起点，格式 YYYY-MM-DD HH:mm:ss */
  hour: string;
  total: number;
  success: number;
  failed: number;
}

/** 单个小时桶的实例生命周期吞吐（发起 / 完结） */
export interface WorkflowEngineInstanceBucket {
  /** 小时桶起点，格式 YYYY-MM-DD HH:mm:ss */
  hour: string;
  created: number;
  completed: number;
}

/** 健康分扣分归因项（让健康分可解释） */
export interface WorkflowEngineScoreFactor {
  /** 扣分原因 */
  reason: string;
  /** 扣分值（正数，表示从 100 中扣减多少） */
  delta: number;
  /** 关联严重级别 */
  severity: 'warning' | 'critical';
}

/** 延迟 / 耗时分布直方图桶 */
export interface WorkflowEngineHistogramBucket {
  /** 桶标签，如 "<50ms" / "50-100ms" / "≥1s" */
  label: string;
  /** 桶下界（毫秒，含） */
  min: number;
  /** 桶上界（毫秒，不含）；null 表示无上界 */
  max: number | null;
  count: number;
}

/** Apdex 满意度（基于事件处理延迟，T = 满意阈值，4T = 容忍阈值） */
export interface WorkflowEngineApdex {
  /** Apdex 分值 0-1；样本为 0 时为 null */
  score: number | null;
  /** 满意阈值 T（毫秒） */
  thresholdMs: number;
  satisfied: number;
  tolerating: number;
  frustrated: number;
  total: number;
}

/** 可配置阈值（来自 system_configs，回显给前端用于解释判定口径） */
export interface WorkflowEngineThresholds {
  healthWarn: number;
  healthCritical: number;
  backlogWarn: number;
  backlogCritical: number;
  errorRateWarn: number;
  errorRateCritical: number;
}

/**
 * 引擎遥测指标（借鉴 Camunda/Zeebe/Temporal 内省端点对外暴露的吞吐 / 延迟 / 生命周期信号）。
 * 仅承载“只能由后端计算”的数据；饱和度、积压、SLA 分布等展示聚合由前端从其它字段派生。
 */
export interface WorkflowEngineTelemetry {
  /** 引擎健康分 0-100（规范化健康度，越高越好） */
  healthScore: number;
  /** 健康分扣分归因（解释 healthScore 为何不是满分） */
  scoreBreakdown: WorkflowEngineScoreFactor[];
  /** 事件处理 Apdex 满意度 */
  apdex: WorkflowEngineApdex;
  /** 事件派发吞吐 + 延迟（Traffic / Errors / Latency） */
  events: {
    last1h: WorkflowEngineThroughputWindow;
    last24h: WorkflowEngineThroughputWindow;
    /** 前一个 24h 窗口（24-48h 前），用于同比 delta */
    prev24h: WorkflowEngineThroughputWindow;
    /** 当前 pending/retrying 待重放事件数 */
    pendingRetry: number;
    /** 近 24h 成功事件的平均处理延迟（processedAt - createdAt，毫秒） */
    avgLatencyMs: number | null;
    /** 近 24h 成功事件处理延迟 P95（毫秒） */
    p95LatencyMs: number | null;
    /** 近 24h 成功事件处理延迟 P99（毫秒） */
    p99LatencyMs: number | null;
    /** 近 24h 成功事件处理延迟分布直方图 */
    latencyHistogram: WorkflowEngineHistogramBucket[];
    /** 近 24h 按小时聚合的吞吐趋势（24 个桶，缺口补 0） */
    series24h: WorkflowEngineEventBucket[];
  };
  /** 触发器执行吞吐 + 延迟 */
  triggers: {
    last24h: { total: number; success: number; failed: number; retrying: number };
    /** 前一个 24h 窗口（24-48h 前）总数，用于同比 delta */
    prev24h: { total: number; success: number; failed: number; retrying: number };
    /** 近 24h 触发器平均耗时（毫秒） */
    avgDurationMs: number | null;
    /** 近 24h 成功触发器耗时 P95（毫秒） */
    p95DurationMs: number | null;
    /** 近 24h 成功触发器耗时 P99（毫秒） */
    p99DurationMs: number | null;
    /** 近 24h 成功触发器耗时分布直方图 */
    durationHistogram: WorkflowEngineHistogramBucket[];
  };
  /** 流程实例生命周期吞吐 */
  instances: {
    running: number;
    createdLast24h: number;
    completedLast24h: number;
    canceledLast24h: number;
    /** 前一个 24h 窗口（24-48h 前）发起 / 完结，用于同比 delta */
    createdPrev24h: number;
    completedPrev24h: number;
    /** 近 24h 按小时聚合的发起 / 完结趋势（24 个桶，缺口补 0） */
    series24h: WorkflowEngineInstanceBucket[];
  };
  /** 系统周期任务及下次执行时间（cron 解析） */
  recurringJobs: Array<{
    name: string;
    cronExpression: string;
    registeredAt: string;
    nextRunAt: string | null;
  }>;
}

export interface WorkflowEngineIntrospection {
  healthy: boolean;
  generatedAt: string;
  thresholdMinutes: number;
  /** 可配置阈值口径回显 */
  thresholds: WorkflowEngineThresholds;
  telemetry: WorkflowEngineTelemetry;
  components: WorkflowEngineComponent[];
  queues: WorkflowEngineQueueSnapshot[];
  definitions: WorkflowEngineDefinitionSnapshot;
  eventBus: WorkflowEngineEventBusSnapshot;
  scheduler: WorkflowEngineSchedulerSnapshot;
  runtime: WorkflowEngineRuntimeSnapshot;
  issues: WorkflowEngineRuntimeIssue[];
}

/** 健康历史趋势单点（由定时任务 platform-wide 采集） */
export interface WorkflowEngineHealthPoint {
  /** 采集时间，格式 YYYY-MM-DD HH:mm:ss */
  capturedAt: string;
  healthScore: number;
  severity: WorkflowEngineComponentStatus;
  backlog: number;
  /** 事件错误率 0-1 */
  errorRate: number;
  criticalCount: number;
  warningCount: number;
  runningInstances: number;
}

export interface WorkflowEngineHealthHistory {
  /** 时间升序排列的健康趋势点 */
  points: WorkflowEngineHealthPoint[];
  /** 阈值口径，便于前端在趋势图上画警戒线 */
  thresholds: WorkflowEngineThresholds;
}

/** 引擎运维动作（复用现有恢复函数；全部为幂等的恢复扫描） */
export type WorkflowEngineActionKey =
  | 'replay-outbox'
  | 'recover-delays'
  | 'recover-subprocess'
  | 'process-timeouts'
  | 'recover-triggers'
  | 'recover-webhooks';

export interface WorkflowEngineActionResult {
  action: WorkflowEngineActionKey;
  ok: boolean;
  /** 人类可读结果摘要 */
  message: string;
  /** 各动作返回的原始计数（scanned/dispatched/resumed 等） */
  detail: Record<string, number>;
}

/** 引擎运维动作的筛选条件（jobType 每个动作固定，此处为附加维度） */
export interface WorkflowEngineActionFilter {
  /** 仅处理指定实例的作业 */
  instanceId?: number;
  /** 仅处理入库超过 N 分钟的作业（避开刚失败还在退避窗内的） */
  olderThanMinutes?: number;
  /** 单次处理上限（条数） */
  limit?: number;
}

/** 运维动作预览的作业样本行 */
export interface WorkflowEngineActionSampleJob {
  id: number;
  jobType: WorkflowJobType;
  status: WorkflowJobStatus;
  instanceId: number | null;
  traceId: string | null;
  attempts: number;
  runAt: string;
  createdAt: string;
  lastError: string | null;
}

/** 运维动作预览结果：筛选后将被处理的作业统计 + 样本，供执行前确认。 */
export interface WorkflowEngineActionPreview {
  action: WorkflowEngineActionKey;
  /** 动作可读名称 */
  label: string;
  /** 该动作固定对应的作业类型 */
  jobTypes: WorkflowJobType[];
  /** pending 且已到期（runAt<=now）——将被处理 */
  duePending: number;
  /** running 卡死——将被回收重跑 */
  stuckRunning: number;
  /** pending 但未到期（runAt>now）——本次不处理，仅提示 */
  scheduledLater: number;
  /** 本次将实际处理的总数（duePending + stuckRunning，受 limit 约束） */
  matched: number;
  /** 生效的单次上限 */
  limit: number;
  /** 样本行（默认前 10 条） */
  sample: WorkflowEngineActionSampleJob[];
}

export type WorkflowHealthIssueType =
  | 'external_dispatch_failed'
  | 'external_dispatch_pending'
  | 'trigger_waiting_no_execution'
  | 'trigger_execution_failed'
  | 'subprocess_waiting'
  | 'delay_overdue'
  | 'delay_missing_wake_job'
  | 'task_timeout_overdue'
  | 'workflow_event_outbox_failed'
  | 'workflow_event_outbox_pending'
  | 'waiting_task_stuck'
  | 'instance_stalled';

export interface WorkflowHealthIssue {
  id: string;
  type: WorkflowHealthIssueType;
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  instanceId: number | null;
  instanceTitle?: string | null;
  taskId?: number | null;
  nodeKey?: string | null;
  nodeName?: string | null;
  status?: string | null;
  ageMinutes: number;
  createdAt: string;
}

export interface WorkflowHealthSummary {
  healthy: boolean;
  checkedAt: string;
  thresholdMinutes: number;
  stats: {
    total: number;
    critical: number;
    warning: number;
    externalFailed: number;
    triggerStuck: number;
    subProcessStuck: number;
    outboxFailed: number;
  };
  issues: WorkflowHealthIssue[];
}

// ─── 工作流：运行中实例迁移 ──────────────────────────────────────────────────────
export interface WorkflowMigrationNode { nodeKey: string; label: string; inNew: boolean; activeTasks: number; activeTokens: number; }

export interface WorkflowMigrationPreflight {
  instanceId: number;
  fromVersion: number;
  toVersion: number;
  migratable: boolean;
  nodes: WorkflowMigrationNode[];
  blocked: string[];
}

export interface WorkflowInstanceMigration {
  id: number; instanceId: number; fromVersion: number; toVersion: number;
  status: string; note: string | null; createdAt: string;
}

// ─── 工作流：补偿/人工修复工单 ──────────────────────────────────────────────────
/** 补偿工单的自动反向/兜底动作执行状态 */
export type WorkflowCompensationActionStatus = 'none' | 'pending' | 'running' | 'succeeded' | 'failed';

export interface WorkflowCompensation {
  id: number; instanceId: number; nodeKey: string; nodeName: string | null;
  errorMessage: string | null; action: string; status: 'pending' | 'resolved' | 'terminated';
  /** 自动反向/兜底动作执行状态 */
  compensationActionStatus: WorkflowCompensationActionStatus;
  /** 失败节点 key（用于恢复续跑重注 token） */
  failedNodeKey: string | null;
  resolution: string | null; resolvedBy: number | null; resolvedAt: string | null; createdAt: string;
}

/** 补偿工单处理历史条目 */
export interface WorkflowCompensationLog {
  id: number;
  compensationId: number;
  action: 'note' | 'attachment' | 'auto' | 'retry' | 'resume' | 'resolve' | 'terminate';
  note: string | null;
  attachments: Array<{ id: number; name: string; url: string }> | null;
  operatorId: number | null;
  operatorName: string | null;
  createdAt: string;
}

/** 补偿工单详情（含处理历史时间线） */
export interface WorkflowCompensationDetail extends WorkflowCompensation {
  logs: WorkflowCompensationLog[];
}
