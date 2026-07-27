import { useMemo, useState } from 'react';
import { Button, Form, Modal, Tabs, TabPane, Typography, useFormApi, useFormState } from '@douyinfe/semi-ui';
import Editor from '@monaco-editor/react';
import { Images, X } from 'lucide-react';
import { MediaPickerModal } from '@/components/MediaPickerModal';
import RichTextEditor from '@/components/RichTextEditor';
import { useThemeController } from '@/providers/theme-controller';
import { CMS_FRAGMENT_TYPES, CMS_FRAGMENT_TYPE_LABELS } from '@zenith/shared';
import type { CmsFragmentType } from '@zenith/shared';

/**
 * 富文本编辑器能否无损往返这段 HTML。
 *
 * wangEditor 只认自己的文档模型（段落 / 标题 / 列表 / 图片…），碰到自定义容器
 * （如 seed 的渐变横幅 `<div style="background:linear-gradient(...)">`）会在往返时
 * 重排甚至丢弃。切过去之前必须提醒，否则运营点一下「可视化」就毁掉了设计块。
 */
export function hasStructuralMarkup(html: string): boolean {
  return /<(?:div|section|table|figure)[\s>]/i.test(html) || /\sstyle=/i.test(html);
}

/** HTML 碎片的双模式编辑器：源码（Monaco）为主，可视化（富文本）兜住纯文案改动 */
function HtmlFragmentEditor({ value, onChange }: Readonly<{ value: string; onChange: (next: string) => void }>) {
  const { isDark } = useThemeController();
  const [mode, setMode] = useState<'source' | 'visual'>('source');
  const structural = useMemo(() => hasStructuralMarkup(value), [value]);

  function handleModeChange(next: string) {
    if (next === mode) return;
    if (next === 'visual' && structural) {
      Modal.confirm({
        title: '可视化编辑可能改写这段 HTML',
        content: '富文本编辑器会按自己的文档结构重排内容，自定义容器与内联样式可能丢失。复杂布局建议保持在源码模式。',
        okText: '仍要切换',
        onOk: () => setMode('visual'),
      });
      return;
    }
    setMode(next as 'source' | 'visual');
  }

  return (
    <Tabs type="line" size="small" activeKey={mode} onChange={handleModeChange} keepDOM={false} lazyRender>
      <TabPane tab="源码" itemKey="source">
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-small)', overflow: 'hidden' }}>
          <Editor
            height={320}
            language="html"
            theme={isDark ? 'vs-dark' : 'light'}
            value={value}
            onChange={(next) => onChange(next ?? '')}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 13,
              lineNumbers: 'on',
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </TabPane>
      <TabPane tab="可视化" itemKey="visual">
        <RichTextEditor value={value} onChange={onChange} height={320} disableFullscreen />
      </TabPane>
    </Tabs>
  );
}

/**
 * 碎片类型 + 内容的联动编辑区。
 *
 * 三种类型的内容形态完全不同（HTML 片段 / 纯文本 / 图片地址），共用一个 TextArea 会让
 * 每种都只剩「自己想办法」：图片要手工粘 URL（绕过媒体库，素材治理看不见这张图）。
 * 因此按类型切换控件，并在类型变更时清理内容——把 HTML 标记留给图片地址没有任何意义。
 */
export function FragmentContentField() {
  const formApi = useFormApi();
  const { values } = useFormState();
  const type = (values.type as CmsFragmentType) ?? 'html';
  const content = (values.content as string) ?? '';
  const [pickerVisible, setPickerVisible] = useState(false);

  function handleTypeChange(next: unknown) {
    const nextType = next as CmsFragmentType;
    if (nextType === type) return;
    if (!content.trim()) {
      formApi.setValue('type', nextType);
      return;
    }
    Modal.confirm({
      title: '切换类型会清空当前内容',
      content: `「${CMS_FRAGMENT_TYPE_LABELS[type]}」的内容在「${CMS_FRAGMENT_TYPE_LABELS[nextType]}」下没有意义，确定要切换吗？`,
      onOk: () => {
        formApi.setValue('type', nextType);
        formApi.setValue('content', '');
      },
      // 取消时把下拉拨回原值，否则界面显示新类型、实际仍是旧类型
      onCancel: () => formApi.setValue('type', type),
    });
  }

  return (
    <>
      <Form.Select
        field="type"
        label="类型"
        style={{ width: 200 }}
        onChange={handleTypeChange}
        optionList={CMS_FRAGMENT_TYPES.map((t) => ({ value: t, label: CMS_FRAGMENT_TYPE_LABELS[t] }))}
      />

      {type === 'image' ? (
        <>
          <Form.Input
            field="content"
            label="图片"
            placeholder="图片地址，建议从媒体库选择"
            suffix={(
              <Button size="small" theme="borderless" icon={<Images size={14} />} onClick={() => setPickerVisible(true)}>
                媒体库
              </Button>
            )}
          />
          {content ? (
            <Form.Slot noLabel>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <img
                  src={content}
                  alt="碎片图片预览"
                  style={{
                    maxWidth: 240,
                    maxHeight: 140,
                    objectFit: 'contain',
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 'var(--semi-border-radius-medium)',
                    background: 'var(--semi-color-fill-0)',
                  }}
                />
                <Button size="small" theme="borderless" icon={<X size={14} />} onClick={() => formApi.setValue('content', '')}>
                  清除
                </Button>
              </div>
            </Form.Slot>
          ) : null}
          <MediaPickerModal
            visible={pickerVisible}
            onCancel={() => setPickerVisible(false)}
            onSelect={(file) => {
              // 从媒体库选图会自动登记进站点素材库并归一为 cms-res:// 句柄，
              // 后续替换素材时全站引用同步生效；手工粘 URL 拿不到这层能力。
              formApi.setValue('content', file.url);
              setPickerVisible(false);
            }}
          />
        </>
      ) : null}

      {type === 'text' ? (
        <Form.TextArea
          field="content"
          label="内容"
          autosize={{ minRows: 4, maxRows: 16 }}
          maxCount={5000}
          placeholder="纯文本内容，前台按文本转义输出，不会解析 HTML"
        />
      ) : null}

      {type === 'html' ? (
        <Form.Slot label="内容">
          <HtmlFragmentEditor value={content} onChange={(next) => formApi.setValue('content', next)} />
          <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
            保存时会统一净化：脚本、事件属性与不在白名单的标签/样式会被移除。
          </Typography.Text>
        </Form.Slot>
      ) : null}
    </>
  );
}

export default FragmentContentField;
