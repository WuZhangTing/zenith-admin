import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDisplayableImageUrl, needsImageTranscode, toDisplayableImageBlob } from './image-decode';

const heic2anyMock = vi.hoisted(() => vi.fn());
const utifMock = vi.hoisted(() => ({
  decode: vi.fn(),
  decodeImage: vi.fn(),
  toRGBA8: vi.fn(),
}));

vi.mock('heic2any', () => ({ default: heic2anyMock }));
// CJS 包经打包器 interop 后模块对象挂在 default 上，mock 按同样形态构造
vi.mock('utif2', () => ({ default: utifMock }));

function blobOf(type: string, bytes = 8) {
  return new Blob([new Uint8Array(bytes)], { type });
}

/** jsdom 无 canvas 实现，按 TIFF 解码链路所需的最小面替身 */
function stubCanvas(output: Blob | null) {
  const context = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
    return {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (cb: (b: Blob | null) => void) => cb(output),
    } as unknown as HTMLElement;
  }) as typeof document.createElement);
  return context;
}

beforeEach(() => {
  vi.restoreAllMocks();
  heic2anyMock.mockReset();
  utifMock.decode.mockReset();
  utifMock.decodeImage.mockReset();
  utifMock.toRGBA8.mockReset();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:stub');
});

describe('needsImageTranscode', () => {
  it.each([
    ['image/heic', 'photo.heic'],
    ['image/heif', 'photo.heif'],
    ['image/heic-sequence', 'live.heic'],
    ['image/tiff', 'scan.tiff'],
    ['image/x-tiff', 'scan.tif'],
  ])('flags %s as needing transcode', (mimeType, fileName) => {
    expect(needsImageTranscode(mimeType, fileName)).toBe(true);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'])(
    'leaves browser-native %s alone',
    (mimeType) => {
      expect(needsImageTranscode(mimeType)).toBe(false);
    },
  );

  it('falls back to the file extension when MIME is missing or generic', () => {
    expect(needsImageTranscode(null, 'IMG_0001.HEIC')).toBe(true);
    expect(needsImageTranscode('application/octet-stream', 'scan.TIF')).toBe(true);
    expect(needsImageTranscode(null, 'photo.png')).toBe(false);
  });

  it('is false for non-images and unknown input', () => {
    expect(needsImageTranscode('application/pdf', 'a.pdf')).toBe(false);
    expect(needsImageTranscode(null, null)).toBe(false);
  });
});

describe('toDisplayableImageBlob', () => {
  it('returns browser-renderable blobs untouched without loading any decoder', async () => {
    const source = blobOf('image/png');
    await expect(toDisplayableImageBlob(source, 'image/png', 'a.png')).resolves.toBe(source);
    expect(heic2anyMock).not.toHaveBeenCalled();
    expect(utifMock.decode).not.toHaveBeenCalled();
  });

  it('converts HEIC to PNG through heic2any', async () => {
    const converted = blobOf('image/png', 4);
    heic2anyMock.mockResolvedValue(converted);
    const result = await toDisplayableImageBlob(blobOf('image/heic'), 'image/heic', 'a.heic');
    expect(result).toBe(converted);
    expect(heic2anyMock).toHaveBeenCalledWith(expect.objectContaining({ toType: 'image/png' }));
  });

  it('unwraps the array form heic2any returns for multi-image HEIC', async () => {
    const first = blobOf('image/png', 4);
    heic2anyMock.mockResolvedValue([first, blobOf('image/png', 5)]);
    await expect(toDisplayableImageBlob(blobOf('image/heic'), null, 'live.heic')).resolves.toBe(first);
  });

  it('decodes the first TIFF page to PNG via canvas', async () => {
    const page = { width: 2, height: 1, data: new Uint8Array() };
    utifMock.decode.mockReturnValue([page, { width: 9, height: 9 }]);
    utifMock.toRGBA8.mockReturnValue(new Uint8Array(2 * 1 * 4));
    const png = blobOf('image/png', 4);
    const context = stubCanvas(png);

    const result = await toDisplayableImageBlob(blobOf('image/tiff'), 'image/tiff', 'scan.tiff');

    expect(result).toBe(png);
    expect(utifMock.decodeImage).toHaveBeenCalledTimes(1);
    expect(utifMock.toRGBA8).toHaveBeenCalledWith(page);
    expect(context.putImageData).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original blob when the decoder throws', async () => {
    heic2anyMock.mockRejectedValue(new Error('corrupt'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = blobOf('image/heic');
    await expect(toDisplayableImageBlob(source, 'image/heic', 'a.heic')).resolves.toBe(source);
  });

  it('falls back to the original blob when the TIFF has no decodable page', async () => {
    utifMock.decode.mockReturnValue([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = blobOf('image/tiff');
    await expect(toDisplayableImageBlob(source, 'image/tiff', 'scan.tiff')).resolves.toBe(source);
  });

  it('uses the blob type when no explicit MIME is provided', async () => {
    const converted = blobOf('image/png', 4);
    heic2anyMock.mockResolvedValue(converted);
    await expect(toDisplayableImageBlob(blobOf('image/heic'))).resolves.toBe(converted);
  });
});

describe('createDisplayableImageUrl', () => {
  it('creates the object URL from the transcoded blob, not the source', async () => {
    const converted = blobOf('image/png', 4);
    heic2anyMock.mockResolvedValue(converted);
    const url = await createDisplayableImageUrl(blobOf('image/heic'), 'image/heic', 'a.heic');
    expect(url).toBe('blob:stub');
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(converted);
  });
});
