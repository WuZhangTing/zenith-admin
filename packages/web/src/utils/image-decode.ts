/**
 * 图片显示前的规范化解码。
 *
 * 浏览器无法原生解码 HEIC/HEIF 与 TIFF：直接把这类文件塞进 `<img>` 会得到裂图。
 * 本模块在创建 Object URL **之前**把它们转成 PNG，使其与普通图片走完全相同的
 * 展示链路（Semi `ImagePreview` 图集），避免为个别格式再引入第二套预览机制。
 *
 * 两个解码器都按需 `import()`，未遇到对应格式时不进入首屏包。
 */
import { resolveFileMimeType } from '@/utils/file-mime';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const TIFF_MIME_TYPES = new Set([
  'image/tiff',
  'image/x-tiff',
]);

/** 解析用于判定的 MIME：显式 MIME 优先，缺失或通用二进制时回退文件名扩展 */
function resolveImageMimeType(
  blob: Blob,
  mimeType?: string | null,
  fileName?: string | null,
): string | null {
  return resolveFileMimeType(mimeType ?? blob.type, fileName);
}

/** 是否为浏览器无法原生解码、需要前端转码的图片格式 */
export function needsImageTranscode(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const mime = resolveFileMimeType(mimeType, fileName)?.toLowerCase();
  return !!mime && (HEIC_MIME_TYPES.has(mime) || TIFF_MIME_TYPES.has(mime));
}

/** CJS/UMD 互操作：命名导出能否被打包器静态识别并不确定，统一按 default 兜底取模块对象 */
function interopDefault<T>(mod: unknown): T {
  return (mod as { default?: T }).default ?? (mod as T);
}

type Heic2Any = typeof import('heic2any').default;
/** 只取实际用到的三个函数：utif2 的模块类型自带合成 default，直接复用会与 interop 结果冲突 */
type UtifModule = Pick<typeof import('utif2'), 'decode' | 'decodeImage' | 'toRGBA8'>;

async function decodeHeicToPng(blob: Blob): Promise<Blob> {
  const heic2any = interopDefault<Heic2Any>(await import('heic2any'));
  const converted = await heic2any({ blob, toType: 'image/png' });
  return Array.isArray(converted) ? converted[0] : converted;
}

async function decodeTiffToPng(blob: Blob): Promise<Blob> {
  const UTIF = interopDefault<UtifModule>(await import('utif2'));
  const buffer = await blob.arrayBuffer();
  const pages = UTIF.decode(buffer);
  if (pages.length === 0) throw new Error('TIFF 文件不包含可解码的图像页');
  // 多页 TIFF 只展示第一页：图集按「一个文件一张图」组织，展开多页会打乱索引对齐
  const page = pages[0];
  UTIF.decodeImage(buffer, page);
  const rgba = UTIF.toRGBA8(page);
  const { width, height } = page;
  if (!width || !height || rgba.length < width * height * 4) {
    throw new Error('TIFF 像素数据不完整');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建 canvas 上下文');
  // 用 context.createImageData 而非全局 ImageData 构造器：后者在部分运行时（含 jsdom）不存在
  const imageData = context.createImageData(width, height);
  imageData.data.set(rgba.subarray(0, width * height * 4));
  context.putImageData(imageData, 0, 0);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('TIFF 转 PNG 失败'))),
      'image/png',
    );
  });
}

/**
 * 转成浏览器可直接渲染的 Blob；无需转码时原样返回。
 *
 * 解码失败不抛出，退回原始 Blob——此时表现与未接入解码层一致（裂图），
 * 不会让整个图集因为其中一张异常图片而中断加载。
 */
export async function toDisplayableImageBlob(
  blob: Blob,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<Blob> {
  const mime = resolveImageMimeType(blob, mimeType, fileName)?.toLowerCase();
  if (!mime) return blob;
  try {
    if (HEIC_MIME_TYPES.has(mime)) return await decodeHeicToPng(blob);
    if (TIFF_MIME_TYPES.has(mime)) return await decodeTiffToPng(blob);
  } catch (error) {
    console.warn(`[image-decode] ${mime} 解码失败，回退原始数据`, error);
  }
  return blob;
}

/**
 * 图片 Blob → 可用于 `<img>` / Semi `ImagePreview` 的 Object URL。
 *
 * 所有图集加载点统一走这里，保证 HEIC/TIFF 与普通图片共用同一套预览交互。
 * 返回的 URL 仍由调用方负责 `revokeObjectURL`。
 */
export async function createDisplayableImageUrl(
  blob: Blob,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<string> {
  const displayable = await toDisplayableImageBlob(blob, mimeType, fileName);
  return URL.createObjectURL(displayable);
}
