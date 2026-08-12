import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEZONE, IANA_TIMEZONE_OPTIONS } from './timezones';

describe('IANA_TIMEZONE_OPTIONS', () => {
  it('prioritizes the default timezone and exposes unique selectable values', () => {
    const values = IANA_TIMEZONE_OPTIONS.map((option) => option.value);

    expect(values[0]).toBe(DEFAULT_TIMEZONE);
    expect(values).toContain('UTC');
    expect(values).toContain('America/New_York');
    expect(new Set(values).size).toBe(values.length);
  });
});
