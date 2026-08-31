/**
 * 字段级 AES-256-GCM 对称加密工具。
 * 用于在数据库中安全存储 SSH 密码、私钥等敏感字段。
 *
 * 加密密钥由环境变量 `FIELD_ENCRYPTION_KEY`（32 字节 hex 字符串）提供；
 * 生产环境必须显式配置，开发环境才允许从 JWT_SECRET 派生临时密钥。
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const configured = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
      throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hexadecimal value');
    }
    return Buffer.from(configured, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FIELD_ENCRYPTION_KEY is required in production');
  }
  const developmentSeed = process.env.JWT_SECRET ?? 'zenith-default-dev-key-not-for-production';
  return createHash('sha256').update(developmentSeed).digest();
}

/**
 * 加密明文字符串，返回 base64 格式：`<iv(12B)><ciphertext><tag(16B)>`。
 * 若 plaintext 为 null/undefined，返回 null。
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * 解密 `encryptField()` 生成的 base64 字符串。
 * 若 ciphertext 为 null/undefined，返回 null。
 */
export function decryptField(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_BYTES);
    const tag = buf.subarray(buf.length - TAG_BYTES);
    const encrypted = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}
