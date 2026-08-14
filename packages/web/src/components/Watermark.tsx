import { useEffect, useRef } from 'react';

interface WatermarkProps {
  content: string | string[];
  fontSize?: number;
  opacity?: number;
  rotate?: number;
  gapX?: number;
  gapY?: number;
  zIndex?: number;
  /** 深色模式下用浅色文字，保证水印可见 */
  isDark?: boolean;
  children: React.ReactNode;
}

interface WatermarkTile {
  dataUrl: string;
  /** 平铺尺寸（CSS 像素），供 background-size 抵消 DPR 放大 */
  cssWidth: number;
  cssHeight: number;
}

function generateTile(
  content: string[],
  fontSize: number,
  opacity: number,
  rotate: number,
  gapX: number,
  gapY: number,
  isDark: boolean,
): WatermarkTile | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const fontFamily = 'sans-serif';
  const scaledFontSize = fontSize * dpr;

  ctx.font = `${scaledFontSize}px ${fontFamily}`;
  const maxWidth = Math.max(...content.map((t) => ctx.measureText(t).width));
  const lineHeight = scaledFontSize * 1.5;
  const textHeight = lineHeight * content.length;

  const tileW = maxWidth + gapX * dpr;
  const tileH = textHeight + gapY * dpr;

  canvas.width = tileW;
  canvas.height = tileH;

  ctx.translate(tileW / 2, tileH / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.translate(-tileW / 2, -tileH / 2);

  // 暗色表面上低亮度差的感知对比更弱：深色模式用纯白并上调等效不透明度，浅色保持原样
  ctx.globalAlpha = Math.min(1, isDark ? opacity * 1.6 : opacity);
  ctx.fillStyle = isDark ? '#fff' : 'rgba(0,0,0,0.65)';
  ctx.font = `${scaledFontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  content.forEach((line, i) => {
    const y = tileH / 2 - textHeight / 2 + lineHeight * i + lineHeight / 2;
    ctx.fillText(line, tileW / 2, y);
  });

  return { dataUrl: canvas.toDataURL(), cssWidth: tileW / dpr, cssHeight: tileH / dpr };
}

export default function Watermark({
  content,
  fontSize = 14,
  opacity = 0.15,
  rotate = -22,
  gapX = 212,
  gapY = 120,
  zIndex = 9,
  isDark = false,
  children,
}: Readonly<WatermarkProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const lines = Array.isArray(content) ? content : [content];

  useEffect(() => {
    const tile = generateTile(lines, fontSize, opacity, rotate, gapX, gapY, isDark);
    if (!tile) return;

    if (!overlayRef.current) {
      const div = document.createElement('div');
      div.style.cssText = [
        'position:absolute',
        'inset:0',
        'pointer-events:none',
        'user-select:none',
        `z-index:${zIndex}`,
      ].join(';');
      overlayRef.current = div;
    }
    overlayRef.current.style.backgroundImage = `url(${tile.dataUrl})`;
    overlayRef.current.style.backgroundRepeat = 'repeat';
    // 画布按 DPR 放大绘制，这里缩回 CSS 尺寸，避免高分屏水印被放大且模糊
    overlayRef.current.style.backgroundSize = `${tile.cssWidth}px ${tile.cssHeight}px`;

    const container = containerRef.current;
    if (container) {
      container.style.position = 'relative';
      container.appendChild(overlayRef.current);
    }

    return () => {
      overlayRef.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines), fontSize, opacity, rotate, gapX, gapY, zIndex, isDark]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {children}
    </div>
  );
}
