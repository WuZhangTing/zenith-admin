/**
 * 字段级 AES-256-GCM 对称加密工具。
 * 用于在数据库中安全存储报表数据源凭据、AI 服务商 API Key、支付渠道密钥等敏感字段。
 *
 * 加密密钥来自 `config.fieldEncryptionKey`（环境变量 `FIELD_ENCRYPTION_KEY`，64 位 hex = 32 字节），
 * 与 lib/secret-crypto.ts 共用。它属于数据库而非某个服务实例：连同一个库的所有实例必须一致。
 * 非开发环境缺失时由服务启动时的 assertRuntimeSecrets() 拦截；NODE_ENV=development 下缺省回落内置开发密钥。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const key = Buffer.from(config.fieldEncryptionKey, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hexadecimal value（运行 `npm run secret:generate` 生成）');
  }
  return key;
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
