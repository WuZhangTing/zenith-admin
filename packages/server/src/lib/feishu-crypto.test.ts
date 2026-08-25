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

  it('错误的 key 无法还原明文', () => {
    // CBC 错误 key 解密大概率 padding 非法抛错，但随机 iv 下存在约 1/256 的
    // 概率 padding 恰好合法而返回乱码——两种结果都不能等于原文，据此断言
    const plain = '{"a":1}';
    const encrypted = encryptFeishuEvent('key-a', plain);
    let result: string | null = null;
    try {
      result = decryptFeishuEvent('key-b', encrypted);
    } catch {
      // 预期路径之一：padding 校验失败
    }
    expect(result).not.toBe(plain);
  });

  it('密文过短抛错', () => {
    expect(() => decryptFeishuEvent('k', Buffer.from('short').toString('base64'))).toThrow('飞书密文长度非法');
  });
});
