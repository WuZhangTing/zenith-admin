/**
 * A/B 实验统计推断单测（analytics-experiment-stats）。
 *
 * 参考值来自标准统计教科书 / R 的 prop.test(correct=FALSE) 与 pchisq，
 * 断言用 toBeCloseTo 容忍近似算法误差（erf 近似 < 1.5e-7）。
 *
 * 覆盖：
 *  - normalCdf / chiSquareSurvival 的已知参考点
 *  - 双比例 Z 检验：显著 / 不显著 / 零方差 / 正态近似不成立 / 零曝光
 *  - p 值与置信区间口径一致（pooled 算 p，unpooled 算 CI，不得自相矛盾到跨 0 与显著并存太离谱）
 *  - SRM 卡方：均衡分流不报警、明显失衡报警、权重非等分
 *  - 样本量估算的单调性与非法输入
 */
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_ALPHA,
  SRM_P_VALUE_THRESHOLD,
  chiSquareSurvival,
  normalCdf,
  requiredSamplePerVariant,
  srmTest,
  twoProportionZTest,
} from './analytics-experiment-stats';

describe('normalCdf — 标准正态累积分布', () => {
  it('matches textbook reference points', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1.959963984540054)).toBeCloseTo(0.025, 6);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(-3)).toBeCloseTo(0.0013499, 6);
  });

  it('is monotonically increasing and bounded in [0, 1]', () => {
    let prev = normalCdf(-6);
    for (let z = -5.5; z <= 6; z += 0.5) {
      const current = normalCdf(z);
      expect(current).toBeGreaterThanOrEqual(prev);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThanOrEqual(1);
      prev = current;
    }
  });
});

describe('chiSquareSurvival — 卡方上尾概率', () => {
  it('matches known critical values (p=0.05)', () => {
    expect(chiSquareSurvival(3.841459, 1)).toBeCloseTo(0.05, 4);
    expect(chiSquareSurvival(5.991465, 2)).toBeCloseTo(0.05, 4);
    expect(chiSquareSurvival(7.814728, 3)).toBeCloseTo(0.05, 4);
  });

  it('matches known critical values (p=0.001) — the SRM alerting threshold', () => {
    expect(chiSquareSurvival(10.827566, 1)).toBeCloseTo(0.001, 4);
    expect(chiSquareSurvival(13.815511, 2)).toBeCloseTo(0.001, 4);
  });

  it('returns 1 for non-positive statistics or degrees of freedom', () => {
    expect(chiSquareSurvival(0, 1)).toBe(1);
    expect(chiSquareSurvival(-1, 1)).toBe(1);
    expect(chiSquareSurvival(5, 0)).toBe(1);
  });
});

describe('twoProportionZTest — 双比例 Z 检验', () => {
  it('detects a clearly significant difference (10% vs 15% on 2000 users per arm)', () => {
    const result = twoProportionZTest(200, 2000, 300, 2000)!;
    expect(result).not.toBeNull();
    expect(result.pValue).toBeLessThan(EXPERIMENT_ALPHA);
    expect(result.absoluteDiff).toBeCloseTo(0.05, 10);
    // 显著时置信区间不应跨 0
    expect(result.confidenceLow).toBeGreaterThan(0);
    expect(result.normalApproxValid).toBe(true);
  });

  it('does not flag a tiny difference on small samples as significant', () => {
    const result = twoProportionZTest(50, 1000, 54, 1000)!;
    expect(result.pValue).toBeGreaterThan(EXPERIMENT_ALPHA);
    // 不显著时置信区间必然跨 0
    expect(result.confidenceLow).toBeLessThan(0);
    expect(result.confidenceHigh).toBeGreaterThan(0);
  });

  it('matches an independently computed reference p-value for a known 2x2 table', () => {
    // 100/1000 vs 130/1000：pooled SE 口径下 z = 2.1027406，χ² = 4.4215181，双尾 p = 0.0354885
    // （用高精度 erf 级数独立复算，与本模块的 A&S 近似互相印证）
    const result = twoProportionZTest(100, 1000, 130, 1000)!;
    expect(result.pValue).toBeCloseTo(0.0354885, 6);
  });

  it('treats a zero-variance case (both arms at 0% conversion) as no difference instead of NaN', () => {
    const result = twoProportionZTest(0, 500, 0, 500)!;
    expect(result.pValue).toBe(1);
    expect(result.absoluteDiff).toBe(0);
    expect(Number.isNaN(result.pValue)).toBe(false);
  });

  it('marks the normal approximation as invalid when any cell has fewer than 5 successes/failures', () => {
    const result = twoProportionZTest(1, 100, 3, 100)!;
    expect(result.normalApproxValid).toBe(false);
  });

  it('returns null when either arm has no exposures — a report must not divide by zero', () => {
    expect(twoProportionZTest(0, 0, 10, 100)).toBeNull();
    expect(twoProportionZTest(10, 100, 0, 0)).toBeNull();
  });

  it('is symmetric in p-value and sign-flipped in the difference when arms are swapped', () => {
    const a = twoProportionZTest(200, 2000, 300, 2000)!;
    const b = twoProportionZTest(300, 2000, 200, 2000)!;
    expect(a.pValue).toBeCloseTo(b.pValue, 10);
    expect(a.absoluteDiff).toBeCloseTo(-b.absoluteDiff, 10);
  });
});

describe('srmTest — 样本比例失衡检验', () => {
  it('does not flag a balanced 50/50 split', () => {
    const result = srmTest([5000, 5010], [50, 50])!;
    expect(result.pValue).toBeGreaterThan(SRM_P_VALUE_THRESHOLD);
    expect(result.mismatch).toBe(false);
  });

  it('flags a badly skewed split that should never happen under a 50/50 config', () => {
    const result = srmTest([5000, 4000], [50, 50])!;
    expect(result.chiSquare).toBeCloseTo(111.111, 2);
    expect(result.pValue).toBeLessThan(SRM_P_VALUE_THRESHOLD);
    expect(result.mismatch).toBe(true);
  });

  it('respects non-uniform configured weights (90/10 traffic split is expected, not a mismatch)', () => {
    const result = srmTest([9000, 1000], [90, 10])!;
    expect(result.chiSquare).toBeCloseTo(0, 6);
    expect(result.mismatch).toBe(false);
  });

  it('handles three variants and ignores zero-weight arms instead of dividing by zero', () => {
    const result = srmTest([3000, 3000, 0], [50, 50, 0])!;
    expect(Number.isFinite(result.chiSquare)).toBe(true);
    expect(result.mismatch).toBe(false);
  });

  it('returns null for malformed input (single arm, length mismatch, zero traffic)', () => {
    expect(srmTest([100], [100])).toBeNull();
    expect(srmTest([100, 100], [50])).toBeNull();
    expect(srmTest([0, 0], [50, 50])).toBeNull();
  });
});

describe('requiredSamplePerVariant — 样本量估算', () => {
  it('requires more samples for a lower baseline conversion rate', () => {
    const low = requiredSamplePerVariant(0.01)!;
    const high = requiredSamplePerVariant(0.2)!;
    expect(low).toBeGreaterThan(high);
  });

  it('requires more samples for a smaller minimum detectable effect', () => {
    const small = requiredSamplePerVariant(0.1, 0.05)!;
    const large = requiredSamplePerVariant(0.1, 0.2)!;
    expect(small).toBeGreaterThan(large);
  });

  it('lands in the right order of magnitude for a 10% baseline / 10% relative MDE', () => {
    // 教科书量级：约 1.4~1.6 万/组
    const n = requiredSamplePerVariant(0.1, 0.1)!;
    expect(n).toBeGreaterThan(10_000);
    expect(n).toBeLessThan(20_000);
  });

  it('returns null for degenerate baselines instead of Infinity', () => {
    expect(requiredSamplePerVariant(0)).toBeNull();
    expect(requiredSamplePerVariant(1)).toBeNull();
    expect(requiredSamplePerVariant(0.1, 0)).toBeNull();
  });
});
