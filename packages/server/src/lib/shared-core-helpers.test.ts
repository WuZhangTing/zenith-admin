/**
 * @zenith/shared/core 通用字符串 / 数值工具单测（shared 包自身不带测试运行器，由 server 侧覆盖）。
 */
import { describe, expect, it } from 'vitest';
import { clamp, escapeHtml, escapeRegExp, formatBytes } from '@zenith/shared/core';

describe('escapeHtml', () => {
  it('转义 HTML 文本与属性中的全部特殊字符', () => {
    expect(escapeHtml(`<a href="x&y" title='t'>`)).toBe('&lt;a href=&quot;x&amp;y&quot; title=&#39;t&#39;&gt;');
  });

  it('普通文本原样返回', () => {
    expect(escapeHtml('张三 & 李四')).toBe('张三 &amp; 李四');
    expect(escapeHtml('plain')).toBe('plain');
  });
});

describe('escapeRegExp', () => {
  it('转义后可作为字面量安全拼入正则', () => {
    const raw = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    expect(new RegExp(`^${escapeRegExp(raw)}$`).test(raw)).toBe(true);
    expect(new RegExp(escapeRegExp('1.5')).test('105')).toBe(false);
  });
});

describe('clamp', () => {
  it('限制在闭区间内', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('非有限数按下界处理', () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(0);
  });
});

describe('formatBytes', () => {
  it('按 1024 进位并保留一位小数，B 取整', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2.0 TB');
  });

  it('超过 TB 仍以 TB 表示', () => {
    expect(formatBytes(3000 * 1024 ** 4)).toBe('3000.0 TB');
  });

  it('空值、非正数与非有限数返回 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
