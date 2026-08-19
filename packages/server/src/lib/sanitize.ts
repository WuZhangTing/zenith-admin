const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'authorization', 'cookie', 'webhook',
  'accessKey', 'access_key', 'privateKey', 'private_key', 'apiKey', 'api_key',
  'clientSecret', 'refreshToken', 'indexNowKey', 'x-api-key', 'apiv3', 'credential',
];

/**
 * 深度脱敏，返回原始对象的克隆副本（敏感字段被替换为 '***'）。
 * 与 sanitizeBody 的区别：返回 object 而非 JSON 字符串，适合结构化日志。
 */
export function redactBody(body: unknown): unknown {
  if (body === null || body === undefined) return body;
  try {
    const clone = structuredClone(body);
    redact(clone);
    return clone;
  } catch {
    return body;
  }
}

export function sanitizeBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  try {
    const clone = structuredClone(body);
    redact(clone);
    return JSON.stringify(clone);
  } catch {
    return JSON.stringify(body).slice(0, 512);
  }
}

function redact(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      (obj as Record<string, unknown>)[key] = '***';
    } else {
      redact((obj as Record<string, unknown>)[key]);
    }
  }
}

// ─── 日志字段写入兜底 ─────────────────────────────────────────────────────────
// 日志表 varchar / smallint 列的值多来自请求头、UA 解析等不可信输入，
// 写入前统一按列长截断 / 越界置 null，防止 PG 报错导致日志丢失甚至阻断主流程。

const SMALLINT_MAX = 32767;

/** 截断到 varchar 列长；空串 / 纯空格返回 null */
export function truncateVarchar(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/** 收敛为 smallint 合法值；非法 / 越界返回 null */
export function clampSmallint(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const int = Math.trunc(value);
  return int >= 0 && int <= SMALLINT_MAX ? int : null;
}
