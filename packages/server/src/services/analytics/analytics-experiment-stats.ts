/**
 * A/B 实验统计推断：双比例 Z 检验 + SRM 卡方检验 + 样本量估算。
 *
 * 纯函数模块，不触碰 DB / 上下文，便于单测覆盖数值边界。
 *
 * 为什么需要：只给转化率对比无法区分「真实效果」与「随机波动」——
 * 5.0% vs 5.4% 在 200 曝光下毫无意义，在 200 万曝光下却是显著提升。
 * 没有 p 值与置信区间，实验结论不可用于决策。
 */

/** 双尾显著性水平（α），行业默认 0.05 */
export const EXPERIMENT_ALPHA = 0.05;

/** α=0.05 双尾对应的临界 z 值 */
const Z_ALPHA_HALF = 1.959963984540054;

/** 统计功效 80% 对应的 z 值（用于样本量估算） */
const Z_POWER_80 = 0.8416212335729143;

/**
 * SRM 判定阈值：分流比例失衡属于「宁可漏报不可误报」的告警，
 * 用 0.001 而非 0.05，避免正常随机波动天天报警。
 */
export const SRM_P_VALUE_THRESHOLD = 0.001;

/** 正态近似成立的最小成功/失败计数（每组），低于此值 p 值不可信 */
const MIN_SUCCESS_FAILURE = 5;

// ─── 数值基础函数 ─────────────────────────────────────────────────────────────

/** erf 近似：Abramowitz & Stegun 7.1.26，绝对误差 < 1.5e-7，对 p 值判定精度足够 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/** 标准正态累积分布函数 Φ(z) */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Numerical Recipes 的 Lanczos g=5, n=6 系数；
// -86.50532032941678 与下方 √(2π) 均写成 JS 双精度的精确可表示值，
// 教科书里的十进制写法会触发 no-loss-of-precision（其双精度值与本处完全一致）
const LANCZOS = [
  76.18009172947146, -86.50532032941678, 24.01409824083091,
  -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

/** √(2π)，Lanczos 公式的归一化常数 */
const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** ln Γ(x)，Lanczos 近似（x > 0） */
function lnGamma(x: number): number {
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += LANCZOS[j] / ++y;
  return -tmp + Math.log((SQRT_2PI * ser) / x);
}

const ITER_MAX = 300;
const EPS = 1e-14;
const FP_MIN = 1e-300;

/** 正则化下不完全伽马函数 P(a,x) 的级数展开（x < a+1 时收敛快） */
function gammaPSeries(a: number, x: number): number {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 0; n < ITER_MAX; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

/** 正则化上不完全伽马函数 Q(a,x) 的连分式展开（x >= a+1 时收敛快） */
function gammaQContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FP_MIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITER_MAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FP_MIN) d = FP_MIN;
    c = b + an / c;
    if (Math.abs(c) < FP_MIN) c = FP_MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** 卡方分布上尾概率 P(X > x)，df 为自由度 */
export function chiSquareSurvival(x: number, df: number): number {
  if (!Number.isFinite(x) || x <= 0 || df <= 0) return 1;
  const a = df / 2;
  const half = x / 2;
  return half < a + 1 ? 1 - gammaPSeries(a, half) : gammaQContinuedFraction(a, half);
}

// ─── 双比例 Z 检验 ────────────────────────────────────────────────────────────

export interface TwoProportionTestResult {
  /** 双尾 p 值 */
  pValue: number;
  /** 绝对差（实验组 - 对照组），比例值（非百分比） */
  absoluteDiff: number;
  /** 绝对差的 95% 置信区间下界 / 上界，比例值 */
  confidenceLow: number;
  confidenceHigh: number;
  /** 正态近似是否成立：两组的成功数与失败数均需 >= 5 */
  normalApproxValid: boolean;
}

/**
 * 两独立样本比例差异检验。
 *
 * p 值用合并比例（pooled proportion）计算标准误——这是原假设「两组比例相等」下的正确口径；
 * 置信区间用各组各自的比例计算标准误（unpooled），因为构造区间时不假设两者相等。
 * 两处若混用同一标准误，会出现「p < 0.05 但置信区间跨 0」的自相矛盾结果。
 */
export function twoProportionZTest(
  controlConversions: number,
  controlExposures: number,
  variantConversions: number,
  variantExposures: number,
): TwoProportionTestResult | null {
  if (controlExposures <= 0 || variantExposures <= 0) return null;
  const p1 = controlConversions / controlExposures;
  const p2 = variantConversions / variantExposures;
  const absoluteDiff = p2 - p1;

  const pooled = (controlConversions + variantConversions) / (controlExposures + variantExposures);
  const pooledSe = Math.sqrt(pooled * (1 - pooled) * (1 / controlExposures + 1 / variantExposures));
  // 两组转化率同为 0 或同为 100% 时标准误为 0，无法计算 z：视为无差异
  const pValue = pooledSe > 0 ? 2 * (1 - normalCdf(Math.abs(absoluteDiff / pooledSe))) : 1;

  const unpooledSe = Math.sqrt((p1 * (1 - p1)) / controlExposures + (p2 * (1 - p2)) / variantExposures);
  const margin = Z_ALPHA_HALF * unpooledSe;

  const normalApproxValid = Math.min(
    controlConversions,
    controlExposures - controlConversions,
    variantConversions,
    variantExposures - variantConversions,
  ) >= MIN_SUCCESS_FAILURE;

  return {
    pValue: Math.min(1, Math.max(0, pValue)),
    absoluteDiff,
    confidenceLow: absoluteDiff - margin,
    confidenceHigh: absoluteDiff + margin,
    normalApproxValid,
  };
}

// ─── SRM（样本比例失衡）检验 ──────────────────────────────────────────────────

export interface SrmTestResult {
  chiSquare: number;
  pValue: number;
  /** true 表示实际分流与配置权重显著不符，实验数据不可信 */
  mismatch: boolean;
}

/**
 * 卡方拟合优度检验：实际各变体曝光数 vs 配置权重的期望分布。
 *
 * SRM 是 A/B 实验最常见的数据可信度问题（SDK 分流 bug、缓存、重复曝光都会触发）。
 * 一旦命中，转化率对比全部失效——必须先修分流再看结论，因此单独提示。
 */
export function srmTest(observed: number[], weights: number[]): SrmTestResult | null {
  if (observed.length < 2 || observed.length !== weights.length) return null;
  const total = observed.reduce((sum, n) => sum + n, 0);
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || weightTotal <= 0) return null;

  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    const expected = (total * weights[i]) / weightTotal;
    // 期望频数为 0 的变体（权重 0）不参与卡方，否则会除零
    if (expected <= 0) continue;
    const diff = observed[i] - expected;
    chiSquare += (diff * diff) / expected;
  }
  const df = observed.length - 1;
  const pValue = chiSquareSurvival(chiSquare, df);
  return { chiSquare, pValue, mismatch: pValue < SRM_P_VALUE_THRESHOLD };
}

// ─── 样本量估算 ───────────────────────────────────────────────────────────────

/**
 * 达到 80% 统计功效、在 α=0.05 下检测出指定相对提升所需的每组曝光量。
 *
 * 用于回答「还要跑多久」：曝光量未达该值时，不显著只说明样本不够，不代表没有效果。
 */
export function requiredSamplePerVariant(baselineRate: number, relativeMde = 0.1): number | null {
  if (!(baselineRate > 0) || baselineRate >= 1 || !(relativeMde > 0)) return null;
  const p1 = baselineRate;
  const p2 = Math.min(baselineRate * (1 + relativeMde), 0.999999);
  const delta = p2 - p1;
  if (delta <= 0) return null;
  const n = ((Z_ALPHA_HALF + Z_POWER_80) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (delta * delta);
  return Math.ceil(n);
}
