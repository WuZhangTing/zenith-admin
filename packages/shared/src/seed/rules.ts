// ─── 规则中心：决策表种子 ────────────────────────────────────────────────────────
export const SEED_DECISION_TABLES = [
  {
    id: 1,
    key: 'member_level',
    name: '会员等级判定',
    description: '按累计消费金额判定会员等级',
    hitPolicy: 'first' as const,
    inputs: [{ key: 'amount', label: '累计金额', expr: 'form.amount', type: 'number' as const }],
    outputs: [{ key: 'level', label: '等级', type: 'string' as const }, { key: 'discount', label: '折扣', type: 'number' as const }],
    rules: [
      { id: 'r1', when: ['>= 10000'], then: { level: 'gold', discount: 0.8 } },
      { id: 'r2', when: ['>= 3000'], then: { level: 'silver', discount: 0.9 } },
      { id: 'r3', when: ['-'], then: { level: 'normal', discount: 1 } },
    ],
  },
  {
    id: 2,
    key: 'payment_risk',
    name: '支付风控策略',
    description: '发布后优先于风控规则原生维度裁决支付下单：命中输出 action=block/review/pass（pass 为显式放行）；未命中或未发布回退原生维度。可用事实：order.*（单笔）、today.*（当日聚合）、hit.*（名单命中 key）、subject.*（openId/userId/ip）',
    hitPolicy: 'first' as const,
    inputs: [
      { key: 'blackHit', label: '命中黑名单', expr: 'hit.black', type: 'string' as const },
      { key: 'amount', label: '单笔金额(分)', expr: 'order.amount', type: 'number' as const },
      { key: 'todayCount', label: '当日笔数', expr: 'today.count', type: 'number' as const },
    ],
    outputs: [
      { key: 'action', label: '动作', type: 'string' as const },
      { key: 'reason', label: '原因', type: 'string' as const },
    ],
    rules: [
      { id: 'r1', when: ['risk_blacklist', '-', '-'], then: { action: 'block', reason: '命中风控黑名单' } },
      { id: 'r2', when: ['-', '>= 5000000', '-'], then: { action: 'review', reason: '单笔大额，转人工审核' } },
      { id: 'r3', when: ['-', '-', '> 20'], then: { action: 'review', reason: '当日交易频次异常' } },
    ],
  },
];

// ─── 规则中心：决策流种子 ────────────────────────────────────────────────────────
export const SEED_DECISION_FLOWS = [
  {
    id: 1,
    key: 'member_benefit_flow',
    name: '会员权益决策流',
    description: '示例：先判定会员等级，再基于等级输出叠加计算（步骤输出并入 scope 供后续引用）',
    steps: [
      { id: 's1', tableKey: 'member_level', label: '等级判定' },
    ],
  },
];

// ─── 规则中心：名单库种子 ────────────────────────────────────────────────────────
export const SEED_RULE_LISTS = [
  { id: 1, key: 'risk_blacklist', name: '风控黑名单', type: 'black' as const, description: '命中即拒绝的高风险主体（手机号/用户ID/IP 等），会员认证 / 支付风控 / CMS 提交共用', status: 'enabled' as const },
  { id: 2, key: 'vip_whitelist',  name: 'VIP 白名单', type: 'white' as const, description: '免风控校验的可信主体', status: 'enabled' as const },
  { id: 3, key: 'cms_watchlist',  name: 'CMS 观察灰名单', type: 'grey' as const, description: '公开评论/表单提交命中不拦截，但在审核队列标注「观察主体」辅助审核', status: 'enabled' as const },
];

export const SEED_RULE_LIST_ITEMS = [
  { id: 1, listId: 1, value: '13800000000', label: '演示黑名单手机号', matchMode: 'exact' as const, expiresAt: null, remark: '示例数据' },
  { id: 2, listId: 1, value: '198.51.100.23', label: '恶意 IP', matchMode: 'exact' as const, expiresAt: null, remark: '示例数据' },
  { id: 3, listId: 2, value: 'member_1001', label: '演示 VIP 会员', matchMode: 'exact' as const, expiresAt: null, remark: '示例数据' },
  { id: 4, listId: 3, value: '203.0.113.', label: '演示观察网段', matchMode: 'prefix' as const, expiresAt: null, remark: '灰名单示例：命中只标注不拦截' },
];;

// ─── 规则中心：评分卡种子 ────────────────────────────────────────────────────────
export const SEED_RULE_SCORECARDS = [
  {
    id: 1,
    key: 'credit_score',
    name: '信用评分卡',
    description: '示例：基础分 300，按年龄/城市等级/逾期次数分段打分，映射信用等级与建议决策',
    baseScore: 300,
    variables: [
      {
        key: 'age', label: '年龄', expr: 'form.age', type: 'number' as const, weight: 2,
        bands: [
          { id: 'b1', op: 'range' as const, min: 18, max: 30, score: 40, label: '18-30 岁' },
          { id: 'b2', op: 'range' as const, min: 30, max: 50, score: 60, label: '30-50 岁' },
          { id: 'b3', op: 'range' as const, min: 50, max: null, score: 45, label: '50 岁以上' },
        ],
      },
      {
        key: 'city_tier', label: '城市等级', expr: 'form.cityTier', type: 'string' as const,
        bands: [
          { id: 'c1', op: 'in' as const, values: ['一线', '新一线'], score: 50 },
          { id: 'c2', op: 'eq' as const, value: '二线', score: 35 },
          { id: 'c3', op: 'default' as const, score: 20, label: '其他城市' },
        ],
      },
      {
        key: 'overdue', label: '近一年逾期次数', expr: 'form.overdueCount', type: 'number' as const, weight: 3,
        bands: [
          { id: 'o1', op: 'range' as const, min: null, max: 1, score: 30, label: '无逾期' },
          { id: 'o2', op: 'range' as const, min: 1, max: 3, score: 0, label: '1-2 次' },
          { id: 'o3', op: 'range' as const, min: 3, max: null, score: -40, label: '3 次以上' },
        ],
      },
    ],
    grades: [
      { grade: 'A', minScore: 500, decision: 'approve' },
      { grade: 'B', minScore: 430, decision: 'review' },
      { grade: 'C', minScore: 0, decision: 'reject' },
    ],
  },
];
