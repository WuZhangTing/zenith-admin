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
  { id: 1, key: 'risk_blacklist', name: '风控黑名单', type: 'black' as const, description: '命中即拒绝的高风险主体（手机号/用户ID/IP 等）', status: 'enabled' as const },
  { id: 2, key: 'vip_whitelist',  name: 'VIP 白名单', type: 'white' as const, description: '免风控校验的可信主体', status: 'enabled' as const },
];

export const SEED_RULE_LIST_ITEMS = [
  { id: 1, listId: 1, value: '13800000000', label: '演示黑名单手机号', expiresAt: null, remark: '示例数据' },
  { id: 2, listId: 1, value: '198.51.100.23', label: '恶意 IP', expiresAt: null, remark: '示例数据' },
  { id: 3, listId: 2, value: 'member_1001', label: '演示 VIP 会员', expiresAt: null, remark: '示例数据' },
];
