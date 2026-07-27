import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Form } from '@douyinfe/semi-ui';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form/interface';
import { describe, it, expect, vi } from 'vitest';
import { ThemeControllerContext, type ThemeControllerValue } from '@/providers/theme-controller';
import { FragmentContentField, hasStructuralMarkup } from './FragmentContentField';

vi.mock('@/components/MediaPickerModal', () => ({
  MediaPickerModal: ({ visible }: { visible: boolean }) => (visible ? <div>MEDIA_PICKER_OPEN</div> : null),
}));

// Monaco 在 jsdom 里跑不起来（需要 worker + 真实布局），用可断言的替身
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="monaco" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('@/components/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="richtext" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function renderField(initValues: Record<string, unknown>) {
  const api: { current: FormApi | null } = { current: null };
  const theme = {
    mode: 'light', themeColor: '#0064fa', isDark: false,
    setThemeMode: () => {}, setThemeColor: () => {}, cycleTheme: () => {}, resetTheme: () => {},
  } as ThemeControllerValue;
  const utils = render(
    <ThemeControllerContext.Provider value={theme}>
      <Form
        allowEmpty
        initValues={initValues}
        labelPosition="left"
        labelWidth={90}
        getFormApi={(a) => { api.current = a; }}
      >
        <FragmentContentField />
      </Form>
    </ThemeControllerContext.Provider>,
  );
  return { ...utils, api };
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

  it('html 类型默认进源码模式，编辑写回表单值', async () => {
    const { api } = renderField({ type: 'html', content: '<p>old</p>' });
    const monaco = screen.getByTestId('monaco') as HTMLTextAreaElement;
    expect(monaco.value).toBe('<p>old</p>');
    fireEvent.change(monaco, { target: { value: '<p>new</p>' } });
    // 内容走 Form.Slot 承载而非注册字段，必须确认 setValue 真的落进了表单值，
    // 否则保存时提交的还是旧内容
    await waitFor(() => {
      expect(api.current?.getValues().content).toBe('<p>new</p>');
    });
  });

  it('切到可视化前拦住结构化 HTML（未确认不切换，避免一点就毁掉设计块）', async () => {
    renderField({ type: 'html', content: '<div style="background:linear-gradient(90deg,#000,#fff)">banner</div>' });
    fireEvent.click(screen.getByText('可视化'));
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(screen.queryByTestId('richtext')).toBeNull();
    expect(screen.getByTestId('monaco')).toBeTruthy();
  });

  it('纯文案 HTML 直接切换到可视化，不打断', async () => {
    renderField({ type: 'html', content: '<p>一段普通文案</p>' });
    fireEvent.click(screen.getByText('可视化'));
    await waitFor(() => {
      expect(screen.getByTestId('richtext')).toBeTruthy();
    });
  });

  it('清除按钮会清空图片地址', async () => {
    const { container } = renderField({ type: 'image', content: '/api/files/abc/content' });
    fireEvent.click(screen.getByText('清除'));
    await waitFor(() => {
      expect(container.querySelector('img[alt="碎片图片预览"]')).toBeNull();
    });
  });
});

describe('富文本往返风险判定', () => {
  // wangEditor 只认自己的文档模型，自定义容器与内联样式往返后会被重排甚至丢弃
  it.each([
    '<div style="background:linear-gradient(90deg,#000,#fff)">x</div>',
    '<section>x</section>',
    '<table><tr><td>x</td></tr></table>',
    '<p style="color:red">x</p>',
  ])('识别为结构化：%s', (html) => {
    expect(hasStructuralMarkup(html)).toBe(true);
  });

  it.each([
    '<p>一段普通文案</p>',
    '<h2>标题</h2><p><strong>加粗</strong></p>',
    '<ul><li>a</li><li>b</li></ul>',
    '',
  ])('识别为可安全往返：%s', (html) => {
    expect(hasStructuralMarkup(html)).toBe(false);
  });
});
