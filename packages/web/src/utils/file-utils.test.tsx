import { describe, expect, it } from 'vitest';
import {
  canPreviewFile,
  guessMimeTypeFromName,
  isArchiveFile,
  isPresentationFile,
  isSpreadsheetFile,
  isWordFile,
  resolveFileMimeType,
} from './file-utils';

const ARCHIVE_EXTENSION_CASES = [
  ['zip', 'application/zip'],
  ['zipx', 'application/x-zip-compressed'],
  ['7z', 'application/x-7z-compressed'],
  ['rar', 'application/vnd.rar'],
  ['tar', 'application/x-tar'],
  ['gz', 'application/gzip'],
  ['gzip', 'application/gzip'],
  ['tgz', 'application/gzip'],
  ['bz2', 'application/x-bzip2'],
  ['bzip2', 'application/x-bzip2'],
  ['tbz', 'application/x-bzip2'],
  ['tbz2', 'application/x-bzip2'],
  ['xz', 'application/x-xz'],
  ['txz', 'application/x-xz'],
  ['lzma', 'application/x-lzma'],
  ['zst', 'application/zstd'],
  ['tzst', 'application/zstd'],
  ['cab', 'application/vnd.ms-cab-compressed'],
  ['ar', 'application/x-archive'],
  ['cpio', 'application/x-cpio'],
  ['iso', 'application/x-iso9660-image'],
  ['xar', 'application/x-xar'],
  ['lha', 'application/x-lzh-compressed'],
  ['lzh', 'application/x-lzh-compressed'],
  ['jar', 'application/java-archive'],
  ['war', 'application/java-archive'],
  ['ear', 'application/java-archive'],
  ['apk', 'application/vnd.android.package-archive'],
  ['cbz', 'application/vnd.comicbook+zip'],
  ['cbr', 'application/vnd.comicbook-rar'],
] as const;

const OFFICE_EXTENSION_CASES = [
  ['doc', 'application/msword', 'word'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'word'],
  ['docm', 'application/vnd.ms-word.document.macroenabled.12', 'word'],
  ['dot', 'application/msword', 'word'],
  ['dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template', 'word'],
  ['dotm', 'application/vnd.ms-word.template.macroenabled.12', 'word'],
  ['odt', 'application/vnd.oasis.opendocument.text', 'word'],
  ['rtf', 'application/rtf', 'word'],
  ['xls', 'application/vnd.ms-excel', 'spreadsheet'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'spreadsheet'],
  ['xlt', 'application/vnd.ms-excel', 'spreadsheet'],
  ['xltx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template', 'spreadsheet'],
  ['xlsm', 'application/vnd.ms-excel.sheet.macroenabled.12', 'spreadsheet'],
  ['xlsb', 'application/vnd.ms-excel.sheet.binary.macroenabled.12', 'spreadsheet'],
  ['xltm', 'application/vnd.ms-excel.template.macroenabled.12', 'spreadsheet'],
  ['csv', 'text/csv', 'spreadsheet'],
  ['tsv', 'text/tab-separated-values', 'spreadsheet'],
  ['ods', 'application/vnd.oasis.opendocument.spreadsheet', 'spreadsheet'],
  ['fods', 'application/vnd.oasis.opendocument.spreadsheet-flat-xml', 'spreadsheet'],
  ['numbers', 'application/vnd.apple.numbers', 'spreadsheet'],
  ['ppt', 'application/vnd.ms-powerpoint', 'presentation'],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation'],
  ['pptm', 'application/vnd.ms-powerpoint.presentation.macroenabled.12', 'presentation'],
  ['potx', 'application/vnd.openxmlformats-officedocument.presentationml.template', 'presentation'],
  ['potm', 'application/vnd.ms-powerpoint.template.macroenabled.12', 'presentation'],
  ['ppsx', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', 'presentation'],
  ['ppsm', 'application/vnd.ms-powerpoint.slideshow.macroenabled.12', 'presentation'],
  ['odp', 'application/vnd.oasis.opendocument.presentation', 'presentation'],
] as const;

const OFFICE_DETECTORS = {
  word: isWordFile,
  spreadsheet: isSpreadsheetFile,
  presentation: isPresentationFile,
};

describe('Office file preview detection', () => {
  it.each(OFFICE_EXTENSION_CASES)(
    'recognizes .%s as %s (%s)',
    (extension, mimeType, kind) => {
      const fileName = `sample.${extension.toUpperCase()}`;
      expect(guessMimeTypeFromName(fileName)).toBe(mimeType);
      expect(OFFICE_DETECTORS[kind](mimeType)).toBe(true);
      expect(canPreviewFile(mimeType, fileName)).toBe(true);
      expect(canPreviewFile('application/octet-stream', fileName)).toBe(true);
    },
  );

  it.each([
    'application/csv',
    'application/x-iwork-numbers-sffnumbers',
  ])('recognizes alternate spreadsheet MIME type %s', (mimeType) => {
    expect(isSpreadsheetFile(mimeType)).toBe(true);
  });

  it.each([
    'application/x-rtf',
    'text/rtf',
  ])('recognizes alternate Word MIME type %s', (mimeType) => {
    expect(isWordFile(mimeType)).toBe(true);
  });

  it('uses the extension only when MIME is absent or generic', () => {
    expect(resolveFileMimeType(null, 'report.xlsm')).toBe('application/vnd.ms-excel.sheet.macroenabled.12');
    expect(resolveFileMimeType('binary/octet-stream', 'slides.ppsx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.slideshow');
    expect(resolveFileMimeType('application/pdf', 'renamed.docx')).toBe('application/pdf');
    expect(resolveFileMimeType('text/csv; charset=utf-8')).toBe('text/csv');
    expect(canPreviewFile('application/x-custom', 'renamed.docx')).toBe(false);
  });

  it('does not treat unrelated files as Office documents', () => {
    expect(isWordFile('application/pdf')).toBe(false);
    expect(isPresentationFile('application/pdf')).toBe(false);
    expect(isSpreadsheetFile('application/pdf')).toBe(false);
    expect(isWordFile(null)).toBe(false);
    expect(isPresentationFile(undefined)).toBe(false);
    expect(isSpreadsheetFile(undefined)).toBe(false);
  });
});

describe('archive file preview detection', () => {
  it.each(ARCHIVE_EXTENSION_CASES)(
    'recognizes .%s as %s',
    (extension, mimeType) => {
      const fileName = `sample.${extension.toUpperCase()}`;
      expect(guessMimeTypeFromName(fileName)).toBe(mimeType);
      expect(isArchiveFile(mimeType)).toBe(true);
      expect(canPreviewFile(mimeType, fileName)).toBe(true);
      expect(canPreviewFile('application/octet-stream', fileName)).toBe(true);
    },
  );

  it.each([
    'application/x-rar-compressed',
    'application/x-gtar',
    'application/x-gzip',
    'application/x-bzip-compressed-tar',
    'application/x-xz-compressed-tar',
    'application/x-zstd-compressed-tar',
  ])('recognizes alternate archive MIME type %s', (mimeType) => {
    expect(isArchiveFile(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType)).toBe(true);
  });

  it('does not classify unrelated MIME types as archives', () => {
    expect(isArchiveFile('application/pdf')).toBe(false);
    expect(isArchiveFile(null)).toBe(false);
  });
});
