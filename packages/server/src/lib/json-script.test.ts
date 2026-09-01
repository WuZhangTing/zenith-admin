import { describe, expect, it } from 'vitest';
import { serializeJsonForScript } from './json-script';

describe('serializeJsonForScript', () => {
  it('keeps script-breaking HTML characters out of the raw text', () => {
    const value = '</script><script>alert(1)</script> &';
    const serialized = serializeJsonForScript(value);

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(serialized)).toBe(value);
  });

  it('escapes line and paragraph separators while preserving JSON semantics', () => {
    const value = { text: 'line\u2028separator\u2029' };
    const serialized = serializeJsonForScript(value);

    expect(serialized).toContain('\\u2028');
    expect(serialized).toContain('\\u2029');
    expect(JSON.parse(serialized)).toEqual(value);
  });

  it('uses JSON null for undefined', () => {
    expect(serializeJsonForScript(undefined)).toBe('null');
  });
});
