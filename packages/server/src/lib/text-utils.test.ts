import { describe, expect, it } from 'vitest';
import { escapeHtml, trimNullableText } from './text-utils';

describe('text utils', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<a href="x&y">')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;');
  });

  it('normalizes optional text and enforces its maximum length', () => {
    expect(trimNullableText(null)).toBeNull();
    expect(trimNullableText('   ')).toBeNull();
    expect(trimNullableText('  hello  ', 4)).toBe('hell');
  });
});
