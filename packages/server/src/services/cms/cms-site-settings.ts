import { CMS_SECRET_MASK, CMS_SITE_OPS_DEFAULTS, type CmsSiteOpsSettings } from '@zenith/shared';

export { CMS_SECRET_MASK };

const SENSITIVE_SETTING_KEY = /(?:secret|token|password|private[_-]?key|api[_-]?key|access[_-]?key|indexnow[_-]?key|credential)/i;

export function isSensitiveCmsSettingKey(key: string): boolean {
  return SENSITIVE_SETTING_KEY.test(key);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveCmsSettingKey(key)
      ? CMS_SECRET_MASK
      : redactValue(nested);
  }
  return out;
}

/** API/export boundary: secrets are represented only by a non-reversible sentinel. */
export function redactCmsSiteSettings(
  settings: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return redactValue(settings ?? {}) as Record<string, unknown>;
}

function mergeValue(existing: unknown, incoming: unknown, key: string): unknown {
  if (isSensitiveCmsSettingKey(key)) {
    if (incoming === undefined || incoming === '' || incoming === CMS_SECRET_MASK) return existing;
    if (incoming === null) return undefined;
    return incoming;
  }
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    const existingRecord = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing as Record<string, unknown>
      : {};
    return mergeCmsSiteSettings(
      existingRecord,
      incoming as Record<string, unknown>,
    );
  }
  return incoming;
}

/**
 * Write-only settings merge.
 * Sensitive empty/sentinel values retain the stored value; explicit null clears it.
 */
export function mergeCmsSiteSettings(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out = cloneRecord(existing ?? {});
  if (!incoming) return out;
  for (const [key, value] of Object.entries(incoming)) {
    const next = mergeValue(out[key], value, key);
    if (next === undefined) delete out[key];
    else out[key] = next;
  }
  return out;
}

/** Creation/import boundary: sentinel and blank secret placeholders never become stored secrets. */
export function normalizeNewCmsSiteSettings(
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return mergeCmsSiteSettings({}, incoming);
}

// ─── 站点内容策略（settings 的受控子集，缺省回落 CMS_SITE_OPS_DEFAULTS）──────────

function boolSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function intSetting(value: unknown, fallback: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.trunc(num), 0), max);
}

/**
 * 解析站点内容策略开关。settings 缺项时回落到 CMS_SITE_OPS_DEFAULTS，
 * 因此新站点与历史站点无需数据迁移即可获得一致行为。
 */
export function resolveCmsSiteOpsSettings(
  settings: Record<string, unknown> | null | undefined,
): CmsSiteOpsSettings {
  const s = settings ?? {};
  return {
    publishedContentEditable: boolSetting(s.publishedContentEditable, CMS_SITE_OPS_DEFAULTS.publishedContentEditable),
    recycleKeepDays: intSetting(s.recycleKeepDays, CMS_SITE_OPS_DEFAULTS.recycleKeepDays, 3650),
    maxPageOnContentPublish: intSetting(s.maxPageOnContentPublish, CMS_SITE_OPS_DEFAULTS.maxPageOnContentPublish, 1000),
    autoReplaceSensitiveWords: boolSetting(s.autoReplaceSensitiveWords, CMS_SITE_OPS_DEFAULTS.autoReplaceSensitiveWords),
    autoReplaceErrorProneWords: boolSetting(s.autoReplaceErrorProneWords, CMS_SITE_OPS_DEFAULTS.autoReplaceErrorProneWords),
    autoCoverFromBody: boolSetting(s.autoCoverFromBody, CMS_SITE_OPS_DEFAULTS.autoCoverFromBody),
  };
}
