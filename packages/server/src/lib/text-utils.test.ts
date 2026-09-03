import { describe, expect, it } from 'vitest';
import { trimNullableText } from './text-utils';

describe('text utils', () => {
  it('normalizes optional text and enforces its maximum length', () => {
    expect(trimNullableText(null)).toBeNull();
    expect(trimNullableText('   ')).toBeNull();
    expect(trimNullableText('  hello  ', 4)).toBe('hell');
  });
});
