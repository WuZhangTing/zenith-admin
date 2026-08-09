const EXT_MIME_MAP: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  ofd: 'application/ofd',
  eml: 'message/rfc822', msg: 'application/vnd.ms-outlook', mbox: 'application/mbox',
  xmind: 'application/vnd.xmind.workbook',
  mermaid: 'text/x-mermaid', mmd: 'text/x-mermaid',
  geojson: 'application/geo+json',
  kml: 'application/vnd.google-earth.kml+xml',
  gpx: 'application/gpx+xml',
  shp: 'application/vnd.shp',
  drawio: 'application/vnd.jgraph.mxfile', dio: 'application/vnd.jgraph.mxfile',
  excalidraw: 'application/vnd.excalidraw+json',
  plantuml: 'text/vnd.plantuml', puml: 'text/vnd.plantuml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon',
  tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif', svg: 'image/svg+xml',
  heic: 'image/heic', heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroenabled.12',
  dot: 'application/msword',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  dotm: 'application/vnd.ms-word.template.macroenabled.12',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlt: 'application/vnd.ms-excel',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  xltm: 'application/vnd.ms-excel.template.macroenabled.12',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  fods: 'application/vnd.oasis.opendocument.spreadsheet-flat-xml',
  numbers: 'application/vnd.apple.numbers',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  potm: 'application/vnd.ms-powerpoint.template.macroenabled.12',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  ppsm: 'application/vnd.ms-powerpoint.slideshow.macroenabled.12',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  psd: 'image/vnd.adobe.photoshop',
  sqlite: 'application/vnd.sqlite3',
  parquet: 'application/vnd.apache.parquet',
  wasm: 'application/wasm',
  csv: 'text/csv', tsv: 'text/tab-separated-values',
  json: 'application/json', xml: 'application/xml',
  zip: 'application/zip', zipx: 'application/x-zip-compressed',
  rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar', gz: 'application/gzip', gzip: 'application/gzip', tgz: 'application/gzip',
  bz2: 'application/x-bzip2', bzip2: 'application/x-bzip2',
  tbz: 'application/x-bzip2', tbz2: 'application/x-bzip2',
  xz: 'application/x-xz', txz: 'application/x-xz', lzma: 'application/x-lzma',
  zst: 'application/zstd', tzst: 'application/zstd',
  cab: 'application/vnd.ms-cab-compressed', ar: 'application/x-archive',
  cpio: 'application/x-cpio', iso: 'application/x-iso9660-image', xar: 'application/x-xar',
  lha: 'application/x-lzh-compressed', lzh: 'application/x-lzh-compressed',
  jar: 'application/java-archive', war: 'application/java-archive', ear: 'application/java-archive',
  apk: 'application/vnd.android.package-archive',
  cbz: 'application/vnd.comicbook+zip', cbr: 'application/vnd.comicbook-rar',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
  ogv: 'video/ogg', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/m4a', opus: 'audio/opus',
  ts: 'text/typescript', tsx: 'text/typescript', js: 'text/javascript', jsx: 'text/javascript',
  html: 'text/html', htm: 'text/html', css: 'text/css',
  yaml: 'text/yaml', yml: 'text/yaml', sh: 'application/x-sh',
  bash: 'application/x-sh', zsh: 'application/x-sh', sql: 'text/x-sql',
  py: 'text/x-python', rs: 'text/x-rust', rb: 'text/plain',
  log: 'text/plain', conf: 'text/plain', ini: 'text/plain', env: 'text/plain', toml: 'text/plain',
};

const GENERIC_BINARY_MIME_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
]);

/** 根据文件名扩展名推断常见 MIME 类型（无法识别时返回 null）。 */
export function guessMimeTypeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_MIME_MAP[name.slice(dot + 1).toLowerCase()] ?? null;
}

/** 优先使用明确 MIME；缺失或为通用二进制类型时，按文件名扩展名回退。 */
export function resolveFileMimeType(
  mimeType: string | null | undefined,
  fileName?: string | null,
): string | null {
  const normalizedMime = mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (normalizedMime && !GENERIC_BINARY_MIME_TYPES.has(normalizedMime)) {
    return normalizedMime;
  }
  return guessMimeTypeFromName(fileName);
}
