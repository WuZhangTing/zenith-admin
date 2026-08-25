import { describe, expect, it } from 'vitest';
import { evaluateScorecard } from './rules-scorecard';

const CARD = {
  baseScore: 300,
  variables: [
    {
      key: 'age', label: '年龄', expr: 'form.age', type: 'number' as const, weight: 2,
      bands: [
        { id: 'b1', op: 'range' as const, min: 18, max: 30, score: 40 },
        { id: 'b2', op: 'range' as const, min: 30, max: null, score: 60 },
        { id: 'b3', op: 'default' as const, score: 10 },
      ],
    },
    {
      key: 'city', label: '城市等级', expr: 'form.city', type: 'string' as const,
      missingScore: -20,
      bands: [
        { id: 'c1', op: 'in' as const, values: ['一线', '新一线'], score: 50 },
        { id: 'c2', op: 'eq' as const, value: '二线', score: 30 },
      ],
    },
  ],
  grades: [
    { grade: 'A', minScore: 420, decision: 'approve' },
    { grade: 'B', minScore: 380, decision: 'review' },
    { grade: 'C', minScore: 0, decision: 'reject' },
  ],
};

describe('evaluateScorecard', () => {
  it('区间与集合分段命中,权重与基础分聚合,等级取最高满足档', () => {
    const r = evaluateScorecard(CARD, { form: { age: 35, city: '一线' } });
    // 300 + 60*2 + 50*1 = 470 → A
    expect(r.totalScore).toBe(470);
    expect(r.grade).toBe('A');
    expect(r.decision).toBe('approve');
    expect(r.variables[0].matchedBand).toBe('[30, +∞)');
    expect(r.variables[1].weighted).toBe(50);
  });

  it('range 上界不含,命中低档区间', () => {
    const r = evaluateScorecard(CARD, { form: { age: 29, city: '二线' } });
    // 300 + 40*2 + 30 = 410 → B
    expect(r.totalScore).toBe(410);
    expect(r.grade).toBe('B');
  });

  it('非数值走 default 兜底分段;变量全部未命中用 missingScore', () => {
    const r = evaluateScorecard(CARD, { form: { age: '非数字', city: '五线' } });
    // 300 + 10*2 + (-20) = 300 → C
    expect(r.totalScore).toBe(300);
    expect(r.variables[0].missed).toBe(false);
    expect(r.variables[1].missed).toBe(true);
    expect(r.decision).toBe('reject');
  });

  it('表达式取值异常按 null 处理,不中断整卡求值', () => {
    const r = evaluateScorecard(CARD, {});
    expect(r.variables).toHaveLength(2);
    expect(r.grade).toBe('C');
  });
});
