import { useEffect, useState } from 'react';
import { Empty, Spin, Typography } from '@douyinfe/semi-ui';
import { useCmsFragmentPreview } from '@/hooks/queries/cms';
import type { CmsFragmentType } from '@zenith/shared';

/** 输入停止后再请求净化，避免逐字敲击打爆接口 */
function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * 预览用的基础样式。
 *
 * 碎片在前台是插进模板插槽的裸片段，没有主题 class 包裹，样式基本自带；
 * 这里只补一层字体与盒模型基线，让预览接近前台观感，不额外注入排版规则。
 */
const PREVIEW_BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 16px; font: 14px/1.6 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1f2328; background: #fff; }
img { max-width: 100%; height: auto; }
a { color: #0969da; }
table { border-collapse: collapse; }
td, th { border: 1px solid #d0d7de; padding: 6px 10px; }
`;

interface FragmentPreviewPanelProps {
  readonly type: CmsFragmentType;
  readonly content: string;
}

/**
 * 碎片实时预览。
 *
 * 碎片改完直接影响线上首页（发布链路会立刻重建站点产物），盲改风险不小，
 * 因此编辑时就要能看到结果。两个关键取舍：
 *
 * 1. **净化走服务端**：预览必须展示「保存后真正会存下来的样子」。前端复刻一份白名单
 *    必然与服务端漂移，预览就又变成所见非所得。
 * 2. **渲染走 sandbox iframe**：`sandbox=""` 关闭脚本执行，即便编辑中的内容含脚本
 *    也跑不起来；同时隔离样式，碎片的 CSS 不会污染后台界面、后台样式也不会扭曲预览。
 */
export function FragmentPreviewPanel({ type, content }: FragmentPreviewPanelProps) {
  const debounced = useDebounced(content);
  const needsSanitize = type === 'html' && debounced.trim().length > 0;
  const previewQuery = useCmsFragmentPreview(type, debounced, needsSanitize);

  if (!content.trim()) {
    return <Empty title="暂无预览" description="填写内容后这里会实时展示前台效果" style={{ padding: 32 }} />;
  }

  if (type === 'image') {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <img src={content} alt="碎片预览" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} />
      </div>
    );
  }

  if (type === 'text') {
    return (
      <Typography.Paragraph style={{ padding: 16, whiteSpace: 'pre-wrap', margin: 0 }}>
        {content}
      </Typography.Paragraph>
    );
  }

  if (previewQuery.isPending) {
    return <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>;
  }
  if (previewQuery.isError) {
    return <Empty title="预览失败" description="内容净化接口暂不可用，请稍后重试" style={{ padding: 32 }} />;
  }

  const sanitized = previewQuery.data?.content ?? '';
  return (
    <>
      <iframe
        title="碎片预览"
        sandbox=""
        srcDoc={`<!doctype html><meta charset="utf-8"><style>${PREVIEW_BASE_CSS}</style>${sanitized}`}
        style={{ width: '100%', height: 320, border: 'none', display: 'block', background: '#fff' }}
      />
      {sanitized !== content ? (
        <Typography.Text type="warning" size="small" style={{ display: 'block', padding: '8px 12px' }}>
          部分标签或样式不在白名单内，保存后会被移除——预览已按净化结果展示。
        </Typography.Text>
      ) : null}
    </>
  );
}

export default FragmentPreviewPanel;
