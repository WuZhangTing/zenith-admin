import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { JsonViewer } from '@douyinfe/semi-ui';

/** JsonViewer 的行高，用于按内容行数估算容器高度 */
const LINE_HEIGHT = 18;

/** 容器宽度低于该值视为尚未完成布局（表格展开行/抽屉动画中），暂不挂载编辑器 */
const MIN_RENDER_WIDTH = 60;

const fallbackStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  background: 'var(--semi-color-fill-0)',
  borderRadius: 'var(--semi-border-radius-medium)',
  fontSize: 12,
  lineHeight: 1.6,
  fontFamily: 'var(--semi-font-family-mono, ui-monospace, monospace)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  overflow: 'auto',
};

interface JsonBlockProps {
  /** 对象按 JSON 序列化；字符串视为已序列化文本（原样解析） */
  readonly value: unknown;
  /** 高度下限，默认 80 */
  readonly minHeight?: number;
  /** 高度上限，超出后内部滚动，默认 240 */
  readonly maxHeight?: number;
  readonly style?: CSSProperties;
}

/**
 * 只读 JSON 行内展示块（详情抽屉、执行结果、请求响应体等场景）。
 *
 * 相比手写 `<pre>{JSON.stringify(v, null, 2)}</pre>`，提供折叠展开、语法高亮与搜索。
 * `JsonViewer` 的 `height` 是必填且不随内容自增，因此这里按行数估算并夹在上下限之间，
 * 否则小对象会留出大片空白、大对象会被压成一条缝。
 *
 * 宽度不能传 "100%"：JsonViewer 是虚拟化编辑器，仅在挂载瞬间测一次容器宽度且不再响应
 * 变化——表格展开行/抽屉在展开动画中挂载时测得极小宽度，内容会坍缩成一条竖缝。
 * 因此外层包一个 block 容器，用 ResizeObserver 测得稳定像素宽后再挂载，并以 key 驱动
 * 宽度变化时重建（只读展示，重建无状态损失）。
 *
 * 内容不是合法 JSON 时降级为等宽 `<pre>`：调用方常传入「可能是 JSON 也可能是纯文本」
 * 的字段（如 webhook 响应体、错误信息），塞进 JSON 编辑器只会显示成一行报错。
 */
export function JsonBlock({ value, minHeight = 80, maxHeight = 240, style }: JsonBlockProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  const text = useMemo(() => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const isJson = useMemo(() => {
    if (!text.trim()) return false;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }, [text]);

  useEffect(() => {
    if (!isJson) return;
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next < MIN_RENDER_WIDTH) return;
      // 4px 容差：忽略滚动条出现/亚像素抖动引发的无意义重建
      setWidth((prev) => (prev !== null && Math.abs(prev - next) <= 4 ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isJson]);

  if (!isJson) {
    return <pre style={{ ...fallbackStyle, ...style }}>{text}</pre>;
  }

  const height = Math.min(maxHeight, Math.max(minHeight, text.split('\n').length * LINE_HEIGHT));
  return (
    <div ref={wrapRef} style={{ minWidth: 0, ...style }}>
      {width !== null && (
        <JsonViewer
          key={width}
          value={text}
          width={width}
          height={height}
          options={{ readOnly: true, autoWrap: true }}
        />
      )}
    </div>
  );
}

export default JsonBlock;
