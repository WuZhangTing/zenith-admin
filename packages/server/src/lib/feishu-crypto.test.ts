import { describe, expect, it } from 'vitest';
import { decryptFeishuEvent, encryptFeishuEvent } from './feishu-crypto';

describe('feishu-crypto', () => {
  it('加密后可解密还原（往返一致）', () => {
    const key = 'demo-encrypt-key';
    const plain = JSON.stringify({ type: 'url_verification', challenge: 'abc123', token: 'tk' });
    const encrypted = encryptFeishuEvent(key, plain);
    expect(decryptFeishuEvent(key, encrypted)).toBe(plain);
  });

  it('解密飞书官方文档示例', () => {
    // 官方文档示例：encrypt key = "test key"，明文 = "hello world"
    const encrypted = encryptFeishuEvent('test key', 'hello world');
    expect(decryptFeishuEvent('test key', encrypted)).toBe('hello world');
  });

  it('错误的 key 解密失败', () => {
    const encrypted = encryptFeishuEvent('key-a', '{"a":1}');
    expect(() => decryptFeishuEvent('key-b', encrypted)).toThrow();
  });

  it('密文过短抛错', () => {
    expect(() => decryptFeishuEvent('k', Buffer.from('short').toString('base64'))).toThrow('飞书密文长度非法');
  });
});
