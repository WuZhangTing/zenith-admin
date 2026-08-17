import type { CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useThemeController } from '@/providers/theme-controller';
import 'highlight.js/styles/github-dark.css';
import './MarkdownPreviewPanel.css';

interface MarkdownPreviewPanelProps {
  readonly content: string;
  /** 为 true 时使用 <pre> 原文本渲染（适用于 .txt 等纳文本文件） */
  readonly rawText?: boolean;
  readonly style?: CSSProperties;
}

/**
 * Markdown 只读预览面板：使用 react-markdown + remark-gfm + rehype-highlight 渲染。
 * 支持 GFM（表格/任务列表/删除线）和代码块语法高亮，无 dangerouslySetInnerHTML。
 */
export function MarkdownPreviewPanel({ content, rawText, style }: MarkdownPreviewPanelProps) {
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
