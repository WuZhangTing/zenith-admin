import { describe, expect, it } from 'vitest';
import { AUDIT_SNAPSHOT_BUDGET_BYTES, clampAuditJson, sliceUtf8Text } from './audit-clamp';

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

describe('clampAuditJson', () => {
  it('小对象原样通过（round-trip 等价）', () => {
    const data = { id: 1, name: '张三', tags: ['a', 'b'], nested: { ok: true, n: null } };
    const str = clampAuditJson(data);
    expect(str).toBeDefined();
    expect(JSON.parse(str!)).toEqual(data);
  });

  it('undefined 输入返回 undefined（与 JSON.stringify 语义一致）', () => {
    expect(clampAuditJson(undefined)).toBeUndefined();
  });

  it('null 与原始类型可序列化', () => {
    expect(clampAuditJson(null)).toBe('null');
    expect(clampAuditJson(42)).toBe('42');
  });

  it('超长字符串值被截断且仍为合法 JSON', () => {
    const data = { content: 'x'.repeat(100_000) };
    const str = clampAuditJson(data)!;
    expect(bytes(str)).toBeLessThanOrEqual(AUDIT_SNAPSHOT_BUDGET_BYTES);
    const parsed = JSON.parse(str) as { content: string };
    expect(parsed.content).toContain('…[截断]');
  });

  it('大数组截断并标注剩余项数', () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ i, v: `item-${i}` }));
    const str = clampAuditJson(data)!;
    expect(bytes(str)).toBeLessThanOrEqual(AUDIT_SNAPSHOT_BUDGET_BYTES);
    const parsed = JSON.parse(str) as unknown[];
    expect(parsed.length).toBeLessThanOrEqual(51);
    expect(parsed.at(-1)).toContain('…[截断');
  });

  it('病态输入（大量键 × 长值）落到摘要兜底且不超预算', () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < 2000; i++) data[`key_${i}`] = '中文内容'.repeat(500);
    const budget = 512;
    const str = clampAuditJson(data, budget)!;
    expect(bytes(str)).toBeLessThanOrEqual(budget);
    const parsed = JSON.parse(str) as Record<string, unknown>;
    expect(parsed._truncated).toBe(true);
    expect(parsed._keyCount).toBe(2000);
  });

  it('中文按 UTF-8 字节计量，预算不被字符数口径蒙混', () => {
    const data = { text: '汉'.repeat(10_000) };
    const str = clampAuditJson(data, 4096)!;
    expect(bytes(str)).toBeLessThanOrEqual(4096);
    expect(() => JSON.parse(str)).not.toThrow();
  });

  it('深层嵌套收敛为深度截断标记', () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 30; i++) deep = { child: deep };
    const str = clampAuditJson(deep)!;
    expect(str).toContain('深度截断');
    expect(() => JSON.parse(str)).not.toThrow();
  });

  it('循环引用不抛异常，由深度限制收敛为合法 JSON', () => {
    const data: Record<string, unknown> = { name: 'loop' };
    data.self = data;
    const str = clampAuditJson(data)!;
    expect(() => JSON.parse(str)).not.toThrow();
    expect(str).toContain('深度截断');
  });

  it('Date 与 BigInt 可序列化', () => {
    const str = clampAuditJson({ at: new Date('2026-01-01T00:00:00Z'), big: 9007199254740993n })!;
    const parsed = JSON.parse(str) as { at: string; big: string };
    expect(parsed.at).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.big).toBe('9007199254740993');
  });
});

describe('sliceUtf8Text', () => {
  it('未超预算原样返回', () => {
    expect(sliceUtf8Text('hello', 1024)).toBe('hello');
  });

  it('超预算按字节截断且不切坏多字节字符', () => {
    const text = '中文混合 mixed 内容'.repeat(1000);
    const out = sliceUtf8Text(text, 4096);
    expect(bytes(out)).toBeLessThanOrEqual(4096);
    expect(out).toContain('…[截断]');
    expect(out).not.toContain('\uFFFD');
  });
});
