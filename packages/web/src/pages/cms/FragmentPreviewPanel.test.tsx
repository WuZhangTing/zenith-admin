import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FragmentPreviewPanel } from './FragmentPreviewPanel';

const previewMock = vi.fn();
vi.mock('@/hooks/queries/cms', () => ({
  useCmsFragmentPreview: (type: string, content: string, enabled: boolean) => previewMock(type, content, enabled),
}));

beforeEach(() => {
  previewMock.mockReset();
  previewMock.mockReturnValue({ data: { content: '' }, isPending: false, isError: false });
});

describe('碎片实时预览', () => {
  it('无内容时给出空态而非空白框', () => {
    render(<FragmentPreviewPanel type="html" content="   " />);
    expect(screen.getByText('暂无预览')).toBeTruthy();
  });

  it('image 类型直接展示图片，不走净化接口', () => {
    const { container } = render(<FragmentPreviewPanel type="image" content="/api/files/abc/content" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/files/abc/content');
    expect(previewMock).toHaveBeenCalledWith('image', expect.anything(), false);
  });

  it('text 类型按纯文本展示，HTML 样值不被解析', () => {
    const { container } = render(<FragmentPreviewPanel type="text" content="<b>粗体</b>" />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>粗体</b>')).toBeTruthy();
  });

  it('html 预览用 sandbox iframe 承载：关脚本 + 隔离样式', async () => {
    previewMock.mockReturnValue({
      data: { content: '<div style="color:red">hi</div>' },
      isPending: false,
      isError: false,
    });
    const { container } = render(<FragmentPreviewPanel type="html" content="<div style=&quot;color:red&quot;>hi</div>" />);
    await waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      // sandbox="" 关闭一切能力（含脚本执行），srcDoc 同时隔离样式
      expect(iframe?.getAttribute('sandbox')).toBe('');
      expect(iframe?.getAttribute('srcdoc')).toContain('<div style="color:red">hi</div>');
    });
  });

  it('净化结果与输入不一致时明确告知会被移除', async () => {
    previewMock.mockReturnValue({
      data: { content: '<div>hi</div>' },
      isPending: false,
      isError: false,
    });
    render(<FragmentPreviewPanel type="html" content='<div style="position:fixed">hi</div>' />);
    await waitFor(() => {
      expect(screen.getByText(/保存后会被移除/)).toBeTruthy();
    });
  });

  it('净化接口失败时给出可理解的提示', () => {
    previewMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    render(<FragmentPreviewPanel type="html" content="<p>x</p>" />);
    expect(screen.getByText('预览失败')).toBeTruthy();
  });
});
