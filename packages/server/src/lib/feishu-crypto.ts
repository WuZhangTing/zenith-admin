import { createHash, createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';

/**
 * 飞书事件订阅加解密。
 * 算法：AES-256-CBC，key = sha256(encryptKey)，密文 base64 解码后前 16 字节为 iv、其余为数据，PKCS7 补位。
 */

function feishuKey(encryptKey: string): Buffer {
  return createHash('sha256').update(encryptKey, 'utf8').digest();
}

/** 解密飞书事件的 encrypt 字段，返回明文 JSON 字符串 */
export function decryptFeishuEvent(encryptKey: string, encrypted: string): string {
  const raw = Buffer.from(encrypted, 'base64');
  if (raw.length <= 16) throw new Error('飞书密文长度非法');
  const iv = raw.subarray(0, 16);
  const data = raw.subarray(16);
  const decipher = createDecipheriv('aes-256-cbc', feishuKey(encryptKey), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 按飞书方案加密明文（供本地测试/回归验证使用） */
export function encryptFeishuEvent(encryptKey: string, plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', feishuKey(encryptKey), iv);
  const data = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  return Buffer.concat([iv, data]).toString('base64');
}
