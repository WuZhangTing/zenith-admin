import { useState } from 'react';
import { Button, Form, Modal, Typography, useFormApi, useFormState } from '@douyinfe/semi-ui';
import { Images, X } from 'lucide-react';
import { MediaPickerModal } from '@/components/MediaPickerModal';
import { CMS_FRAGMENT_TYPES, CMS_FRAGMENT_TYPE_LABELS } from '@zenith/shared';
import type { CmsFragmentType } from '@zenith/shared';

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
        <Form.TextArea
          field="content"
          label="内容"
          rows={10}
          placeholder="HTML 片段"
        />
      ) : null}

      {type === 'html' ? (
        <Form.Slot noLabel>
          <Typography.Text type="tertiary" size="small">
            保存时会统一净化：脚本、事件属性与不在白名单的标签会被移除。
          </Typography.Text>
        </Form.Slot>
      ) : null}
    </>
  );
}

export default FragmentContentField;
