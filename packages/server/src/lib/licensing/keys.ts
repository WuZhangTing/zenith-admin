import { createPublicKey, type KeyObject } from 'node:crypto';
import { config } from '../../config';

/**
 * 内置测试公钥（keyId=test-2026）。
 *
 * ⚠️ 仅供开发/评估：配套私钥公开在 scripts/license-issue.ts，任何人都能签发
 * 能通过该公钥验证的 License。生产部署必须设置 LICENSE_ISSUER_PUBLIC_KEY
 * 指向自己保管的密钥对（scripts/license-issue.ts --gen-keys 生成）。
 */
export const TEST_KEY_ID = 'test-2026';
export const TEST_PUBLIC_KEY_BASE64 = 'MCowBQYDK2VwAyEAbX6fWw/YVG60h7QeoV1qRZfOH0zvzVfP5AMgjrM5IK8=';

const keyCache = new Map<string, KeyObject>();

function importSpki(base64: string): KeyObject {
  return createPublicKey({ key: Buffer.from(base64, 'base64'), format: 'der', type: 'spki' });
}

/** 是否在使用内置测试公钥（状态页据此提示「评估模式」） */
export function usingTestIssuerKey(): boolean {
  return !config.licenseIssuerPublicKey;
}

/**
 * 解析验签公钥。设置了 LICENSE_ISSUER_PUBLIC_KEY 时只信任该公钥；
 * 未设置时回退到内置测试公钥（keyId 必须匹配 test-2026）。
 */
export function resolveIssuerPublicKey(keyId: string): KeyObject | null {
  const configured = config.licenseIssuerPublicKey;
  const base64 = configured || (keyId === TEST_KEY_ID ? TEST_PUBLIC_KEY_BASE64 : null);
  if (!base64) return null;
  let cached = keyCache.get(base64);
  if (!cached) {
    try {
      cached = importSpki(base64);
    } catch {
      return null;
    }
    keyCache.set(base64, cached);
  }
  return cached;
}
