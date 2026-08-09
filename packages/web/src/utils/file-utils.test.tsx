import { describe, expect, it } from 'vitest';
import {
  canPreviewFile,
  guessMimeTypeFromName,
  isArchiveFile,
  isDataAssetFile,
  isDrawingFile,
  isEmailFile,
  isGalleryImageFile,
  isMindMapFile,
  isOfdFile,
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

const FILE_VIEWER_EXTENSION_CASES = [
  ['eml', 'message/rfc822', 'email'],
  ['msg', 'application/vnd.ms-outlook', 'email'],
  ['mbox', 'application/mbox', 'email'],
  ['xmind', 'application/vnd.xmind.workbook', 'mindmap'],
  ['mermaid', 'text/x-mermaid', 'drawing'],
  ['mmd', 'text/x-mermaid', 'drawing'],
  ['drawio', 'application/vnd.jgraph.mxfile', 'drawing'],
  ['dio', 'application/vnd.jgraph.mxfile', 'drawing'],
  ['excalidraw', 'application/vnd.excalidraw+json', 'drawing'],
  ['plantuml', 'text/vnd.plantuml', 'drawing'],
  ['puml', 'text/vnd.plantuml', 'drawing'],
] as const;

const FILE_VIEWER_DETECTORS = {
  email: isEmailFile,
  mindmap: isMindMapFile,
  drawing: isDrawingFile,
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

describe('email, XMind and drawing preview detection', () => {
  it.each(FILE_VIEWER_EXTENSION_CASES)(
    'recognizes .%s as %s (%s)',
    (extension, mimeType, kind) => {
      const fileName = `sample.${extension.toUpperCase()}`;
      expect(guessMimeTypeFromName(fileName)).toBe(mimeType);
      expect(FILE_VIEWER_DETECTORS[kind](mimeType)).toBe(true);
      expect(canPreviewFile(mimeType, fileName)).toBe(true);
      expect(canPreviewFile('application/octet-stream', fileName)).toBe(true);
    },
  );

  it.each([
    ['application/x-mbox', isEmailFile],
    ['application/x-xmind', isMindMapFile],
    ['text/vnd.mermaid', isDrawingFile],
    ['application/vnd.mermaid', isDrawingFile],
    ['application/x-drawio', isDrawingFile],
    ['text/x-plantuml', isDrawingFile],
  ] as const)('recognizes alternate MIME type %s', (mimeType, detector) => {
    expect(detector(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType)).toBe(true);
  });

  it('does not classify unrelated MIME types as these formats', () => {
    expect(isEmailFile('application/pdf')).toBe(false);
    expect(isMindMapFile('application/pdf')).toBe(false);
    expect(isDrawingFile('application/pdf')).toBe(false);
    expect(isEmailFile(null)).toBe(false);
    expect(isMindMapFile(undefined)).toBe(false);
    expect(isDrawingFile(null)).toBe(false);
  });
});

const DATA_ASSET_EXTENSION_CASES = [
  ['ttf', 'font/ttf'],
  ['otf', 'font/otf'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['psd', 'image/vnd.adobe.photoshop'],
  ['sqlite', 'application/vnd.sqlite3'],
  ['parquet', 'application/vnd.apache.parquet'],
  ['wasm', 'application/wasm'],
] as const;

describe('data asset preview detection', () => {
  it.each(DATA_ASSET_EXTENSION_CASES)('recognizes .%s as %s', (extension, mimeType) => {
    const fileName = `sample.${extension.toUpperCase()}`;
    expect(guessMimeTypeFromName(fileName)).toBe(mimeType);
    expect(isDataAssetFile(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType, fileName)).toBe(true);
    expect(canPreviewFile('application/octet-stream', fileName)).toBe(true);
  });

  it.each([
    'application/x-sqlite3',
    'application/x-parquet',
    'application/x-font-ttf',
    'application/font-woff',
    'image/x-photoshop',
    'application/x-photoshop',
  ])('recognizes alternate data asset MIME type %s', (mimeType) => {
    expect(isDataAssetFile(mimeType)).toBe(true);
    expect(canPreviewFile(mimeType)).toBe(true);
  });

  it('does not offer Avro preview: avsc cannot load under Vite without Node polyfills', () => {
    expect(guessMimeTypeFromName('events.avro')).toBeNull();
    expect(isDataAssetFile('application/vnd.apache.avro')).toBe(false);
    expect(canPreviewFile('application/octet-stream', 'events.avro')).toBe(false);
  });

  it('does not classify unrelated MIME types as data assets', () => {
    expect(isDataAssetFile('application/pdf')).toBe(false);
    expect(isDataAssetFile('image/png')).toBe(false);
    expect(isDataAssetFile(null)).toBe(false);
  });

  it('keeps PSD out of the browser image gallery despite its image/* MIME', () => {
    // image/vnd.adobe.photoshop 以 image/ 开头，用前缀判断会把 PSD 塞进 ImagePreview 变成裂图
    expect('image/vnd.adobe.photoshop'.startsWith('image/')).toBe(true);
    expect(isGalleryImageFile('image/vnd.adobe.photoshop', 'design.psd')).toBe(false);
    expect(isGalleryImageFile('application/octet-stream', 'design.psd')).toBe(false);
  });

  it.each([
    ['image/png', 'a.png'],
    ['image/jpeg', 'a.jpg'],
    ['image/svg+xml', 'a.svg'],
    // HEIC/TIFF 经 image-decode 转码后照常进图集，仍属于图片链路
    ['image/heic', 'a.heic'],
    ['image/tiff', 'a.tiff'],
  ])('keeps %s in the image gallery', (mimeType, fileName) => {
    expect(isGalleryImageFile(mimeType, fileName)).toBe(true);
  });

  it('is false for non-images in the gallery predicate', () => {
    expect(isGalleryImageFile('application/pdf', 'a.pdf')).toBe(false);
    expect(isGalleryImageFile(null, null)).toBe(false);
  });
});

describe('OFD file preview detection', () => {
  it('recognizes the .ofd extension and canonical MIME type', () => {
    expect(guessMimeTypeFromName('invoice.OFD')).toBe('application/ofd');
    expect(isOfdFile('application/ofd')).toBe(true);
    expect(canPreviewFile('application/ofd', 'invoice.ofd')).toBe(true);
    expect(canPreviewFile('application/octet-stream', 'invoice.ofd')).toBe(true);
  });

  it('recognizes the alternate OFD MIME type', () => {
    expect(isOfdFile('application/vnd.ofd')).toBe(true);
    expect(canPreviewFile('application/vnd.ofd', 'invoice.ofd')).toBe(true);
  });

  it('does not classify unrelated MIME types as OFD', () => {
    expect(isOfdFile('application/pdf')).toBe(false);
    expect(isOfdFile(null)).toBe(false);
  });
});
