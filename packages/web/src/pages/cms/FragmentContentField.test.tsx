import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Form } from '@douyinfe/semi-ui';
import { describe, it, expect, vi } from 'vitest';
import { FragmentContentField } from './FragmentContentField';

vi.mock('@/components/MediaPickerModal', () => ({
  MediaPickerModal: ({ visible }: { visible: boolean }) => (visible ? <div>MEDIA_PICKER_OPEN</div> : null),
}));

function renderField(initValues: Record<string, unknown>) {
  return render(
    <Form allowEmpty initValues={initValues} labelPosition="left" labelWidth={90}>
      <FragmentContentField />
    </Form>,
  );
}

describe('碎片内容编辑区按类型切换控件', () => {
  it('image 类型提供媒体库入口与缩略预览', () => {
    const { container } = renderField({ type: 'image', content: '/api/files/abc/content' });
    expect(screen.getByText('媒体库')).toBeTruthy();
    // 手工粘 URL 会绕过素材治理，因此必须给出媒体库入口
    const img = container.querySelector('img[alt="碎片图片预览"]') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('/api/files/abc/content');
    expect(screen.getByText('清除')).toBeTruthy();
  });

  it('image 类型无内容时不渲染预览与清除', () => {
    const { container } = renderField({ type: 'image', content: '' });
    expect(container.querySelector('img[alt="碎片图片预览"]')).toBeNull();
    expect(screen.queryByText('清除')).toBeNull();
  });

  it('text 类型不出现媒体库入口', () => {
    renderField({ type: 'text', content: 'hello' });
    expect(screen.queryByText('媒体库')).toBeNull();
  });

  it('html 类型提示内容会被净化', () => {
    renderField({ type: 'html', content: '<p>x</p>' });
    expect(screen.getByText(/统一净化/)).toBeTruthy();
  });

  it('清除按钮会清空图片地址', async () => {
    const { container } = renderField({ type: 'image', content: '/api/files/abc/content' });
    fireEvent.click(screen.getByText('清除'));
    await waitFor(() => {
      expect(container.querySelector('img[alt="碎片图片预览"]')).toBeNull();
    });
  });
});
