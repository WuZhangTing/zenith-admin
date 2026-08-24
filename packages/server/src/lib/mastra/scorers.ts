import logger from '../logger';
import type { Mastra } from '@mastra/core';

/**
 * 评测打分器注册(目录契约见 shared AI_EVAL_SCORERS):
 * - code 类(ground-truth / completeness / keyword-coverage):纯算法零成本,
 *   buildMastra 时一次性注册;
 * - llm 类(answer-similarity / answer-relevancy / toxicity / bias):
 *   LLM-as-judge,评审模型取「当前」系统默认服务商配置——发起实验时经
 *   ensureLlmScorers() 重新注册,评审模型跟随配置变化,不被进程启动时冻结。
 */

/** code 类打分器:无条件注册(无 LLM 依赖) */
export async function registerCodeScorers(mastra: Mastra): Promise<void> {
  const { createScorer } = await import('@mastra/core/evals');

  // ground-truth:输出与期望答案的词面重合度。bigram 算法对中英文语料均有效
  // (内置库的 code 类 scorer 基于英文 NLP,对中文无效,不接入——见 shared AI_EVAL_SCORERS)
  const groundTruthScorer = createScorer({
    id: 'ground-truth',
    name: 'ground-truth',
    description: '模型输出与期望答案(groundTruth)的词面重合度(0-1)',
  }).generateScore(({ run }: { run: { output?: unknown; groundTruth?: unknown } }) => {
    const textOf = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && 'text' in (v as Record<string, unknown>)) return String((v as { text: unknown }).text ?? '');
      return JSON.stringify(v ?? '');
    };
    const output = textOf(run.output).toLowerCase();
    const expected = textOf(run.groundTruth).toLowerCase().trim();
    if (!expected) return 1;
    if (!output) return 0;
    // 以期望答案的字符 bigram 命中率近似重合度(对中英文均适用)
    const grams = new Set<string>();
    for (let i = 0; i < expected.length - 1; i++) grams.add(expected.slice(i, i + 2));
    if (grams.size === 0) return output.includes(expected) ? 1 : 0;
    let hit = 0;
    for (const g of grams) if (output.includes(g)) hit++;
    return Math.round((hit / grams.size) * 1000) / 1000;
  });
  mastra.addScorer(groundTruthScorer as never, 'ground-truth');
}

/**
 * llm 类打分器:以当前默认服务商配置为评审模型注册。
 * addScorer 对已注册 key 直接跳过,先 removeScorer 再注册实现「评审模型跟随配置刷新」。
 * 无可用配置时返回 false(调用方据此报错或跳过)。
 */
export async function ensureLlmScorers(mastra: Mastra): Promise<boolean> {
  const [{ getRawDefaultProviderConfig }, { toMastraModel }] = await Promise.all([
    import('../../services/ai/ai-providers.service'),
    import('../ai/mastra-models'),
  ]);
  const cfg = await getRawDefaultProviderConfig();
  if (!cfg?.isEnabled) return false;

  const judge = toMastraModel(cfg, cfg.defaultModel);
  const {
    createAnswerSimilarityScorer,
    createAnswerRelevancyScorer,
    createToxicityScorer,
    createBiasScorer,
  } = await import('@mastra/evals/scorers/prebuilt');

  const scorers = [
    createAnswerSimilarityScorer({ model: judge }),
    createAnswerRelevancyScorer({ model: judge }),
    createToxicityScorer({ model: judge }),
    createBiasScorer({ model: judge }),
  ];
  const m = mastra as unknown as { removeScorer: (keyOrId: string) => void; addScorer: (scorer: unknown) => void };
  for (const scorer of scorers) {
    try { m.removeScorer((scorer as { id: string }).id); } catch { /* 首次注册尚不存在 */ }
    m.addScorer(scorer);
  }
  return true;
}

/** buildMastra 装配时调用:code 类必注册,llm 类尽力注册(无默认配置时静默跳过) */
export async function registerAllScorers(mastra: Mastra): Promise<void> {
  try {
    await registerCodeScorers(mastra);
  } catch (err) {
    logger.warn('[mastra] register code scorers failed', err);
  }
  try {
    await ensureLlmScorers(mastra);
  } catch (err) {
    logger.warn('[mastra] register llm scorers failed', err);
  }
}
