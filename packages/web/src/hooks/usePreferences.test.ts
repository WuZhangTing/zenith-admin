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
    expect(sanitizeImportedPreferences({ loadingStyle: 'flip' })).toEqual({
      loadingStyle: 'flip',
    });
  });

  it('migrates the removed pulse style when importing preferences', () => {
    expect(sanitizeImportedPreferences({ loadingStyle: 'pulse' })).toEqual({
      loadingStyle: 'flip',
    });
  });

  it('rejects unknown loading styles when importing preferences', () => {
    expect(sanitizeImportedPreferences({ loadingStyle: 'unknown' })).toBeNull();
  });
});
