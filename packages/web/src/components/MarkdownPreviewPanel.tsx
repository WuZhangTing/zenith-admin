import type { CSSProperties, ReactNode } from 'react';
import { isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useThemeController } from '@/providers/theme-controller';
import { slugifyHeading } from '@/utils/markdown-outline';
import 'highlight.js/styles/github-dark.css';
import './MarkdownPreviewPanel.css';

interface MarkdownPreviewPanelProps {
  readonly content: string;
  /** 为 true 时使用 <pre> 原文本渲染（适用于 .txt 等纳文本文件） */
  readonly rawText?: boolean;
  /** 为 true 时给 h1-h3 注入 slug 锚点 id，配合大纲（TOC）定位；slug 规则见 utils/markdown-outline */
  readonly anchorHeadings?: boolean;
  readonly style?: CSSProperties;
}

/** 递归取 React 子树的纯文本（标题含行内代码/加粗时仍能得到稳定 slug） */
function childrenText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return childrenText(node.props.children);
  return '';
}

function anchoredHeading(Level: 'h1' | 'h2' | 'h3') {
  return function AnchoredHeading({ node: _node, children, ...rest }: { node?: unknown; children?: ReactNode }) {
    return <Level id={slugifyHeading(childrenText(children))} {...rest}>{children}</Level>;
  };
}

const ANCHORED_HEADING_COMPONENTS = {
  h1: anchoredHeading('h1'),
  h2: anchoredHeading('h2'),
  h3: anchoredHeading('h3'),
};

/**
 * Markdown 只读预览面板：使用 react-markdown + remark-gfm + rehype-highlight 渲染。
 * 支持 GFM（表格/任务列表/删除线）和代码块语法高亮，无 dangerouslySetInnerHTML。
 */
export function MarkdownPreviewPanel({ content, rawText, anchorHeadings, style }: MarkdownPreviewPanelProps) {
  const { isDark } = useThemeController();

  return (
    <div
      className={`md-preview-body${isDark ? ' md-preview-body--dark' : ''}`}
      style={{ width: '100%', height: '100%', overflowY: 'auto', ...style }}
    >
      {rawText ? (
        <pre
          style={{
            margin: 0,
            padding: '24px 32px',
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--semi-color-text-0)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {content}
        </pre>
      ) : (
        <div className="md-preview-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // 外部链接新窗口打开，避免用户在阅读中被整页带离应用；站内相对链接保持默认行为
              a: ({ node: _node, href, children, ...rest }) => {
                const external = /^https?:\/\//i.test(href ?? '');
                return (
                  <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
                    {children}
                  </a>
                );
              },
              ...(anchorHeadings ? ANCHORED_HEADING_COMPONENTS : {}),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default MarkdownPreviewPanel;
