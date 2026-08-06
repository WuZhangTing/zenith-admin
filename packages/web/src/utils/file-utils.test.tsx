import { describe, expect, it } from 'vitest';
import { canPreviewFile, isPresentationFile, isWordFile } from './file-utils';

describe('Office file preview detection', () => {
  it.each([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])('recognizes Word MIME type %s', (mimeType) => {
    expect(isWordFile(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType)).toBe(true);
  });

  it.each([
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ])('recognizes PowerPoint MIME type %s', (mimeType) => {
    expect(isPresentationFile(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType)).toBe(true);
  });

  it('does not treat unrelated files as Office documents', () => {
    expect(isWordFile('application/pdf')).toBe(false);
    expect(isPresentationFile('application/pdf')).toBe(false);
    expect(isWordFile(null)).toBe(false);
    expect(isPresentationFile(undefined)).toBe(false);
  });
});
