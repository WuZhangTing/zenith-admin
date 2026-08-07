import { describe, expect, it } from 'vitest';
import {
  defaultPreferences,
  sanitizeImportedPreferences,
} from './usePreferences';

describe('loading style preference', () => {
  it('keeps the existing dots animation as the default', () => {
    expect(defaultPreferences.loadingStyle).toBe('dots');
  });

  it('accepts known loading styles when importing preferences', () => {
    expect(sanitizeImportedPreferences({ loadingStyle: 'pulse' })).toEqual({
      loadingStyle: 'pulse',
    });
  });

  it('rejects unknown loading styles when importing preferences', () => {
    expect(sanitizeImportedPreferences({ loadingStyle: 'unknown' })).toBeNull();
  });
});
