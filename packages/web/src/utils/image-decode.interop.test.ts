/**
 * 解码器 CJS/UMD 互操作契约测试。
 *
 * `utif2` 与 `heic2any` 都是 CJS/UMD 包，且 `utif2` 的导出是在 IIFE 里动态挂到对象上的，
 * 打包器的命名导出静态分析对它并不可靠：`import('utif2').decode` 可能是 `undefined`，
 * 而 TypeScript 因为包内自带 `UTIF.d.ts` 声明了命名导出并不会报错——
 * 这类问题只在运行时暴露，所以用真实文件而非 mock 守住这条边界。
 */
import { describe, expect, it } from 'vitest';

/** 真实 deflate 压缩的 2x2 RGB TIFF（红 / 绿 / 蓝 / 白），同时覆盖 utif2 的 pako 解压路径 */
const TIFF_B64 = 'SUkqAAgAAAAJAAABAwABAAAAAgAAAAEBAwABAAAAAgAAAAIBAwADAAAAegAAAAMBAwABAAAACAAAAAYBAwABAAAAAgAAABEBBAABAAAAgAAAABUBAwABAAAAAwAAABYBAwABAAAAAgAAABcBBAABAAAAEgAAAAAAAAAIAAgACAB4nPvPwMDwH4T///8PAB3uBfs=';

describe('image decoder interop', () => {
  it('keeps utif2 decode/decodeImage/toRGBA8 callable and decodes real pixels', async () => {
    const mod = await import('utif2');
    const UTIF = (mod as unknown as { default?: typeof mod }).default ?? mod;
    expect(typeof UTIF.decode).toBe('function');
    expect(typeof UTIF.decodeImage).toBe('function');
    expect(typeof UTIF.toRGBA8).toBe('function');

    const bytes = Uint8Array.from(atob(TIFF_B64), (c) => c.codePointAt(0)!);
    const pages = UTIF.decode(bytes.buffer);
    expect(pages.length).toBeGreaterThan(0);

    UTIF.decodeImage(bytes.buffer, pages[0]);
    expect(pages[0].width).toBe(2);
    expect(pages[0].height).toBe(2);

    const rgba = UTIF.toRGBA8(pages[0]);
    expect(rgba.length).toBe(2 * 2 * 4);
    expect([...rgba.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([0, 255, 0, 255]);
  });

  it('keeps heic2any resolving to a callable', async () => {
    // heic2any 在模块加载期就创建 Web Worker；jsdom 没有 Worker，仅为验证 interop 形态打桩
    (globalThis as { Worker?: unknown }).Worker = class {
      postMessage() {}
      terminate() {}
      addEventListener() {}
    };
    const mod = await import('heic2any');
    const heic2any = (mod as { default?: unknown }).default ?? mod;
    expect(typeof heic2any).toBe('function');
  });
});
