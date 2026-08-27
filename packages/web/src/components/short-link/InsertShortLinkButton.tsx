import { Button, Form } from '@douyinfe/semi-ui';
import { Link2 } from 'lucide-react';
import AppModal from '@/components/AppModal';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useSaveShortLink } from '@/hooks/queries/short-links';
import type { ShortLink } from '@zenith/shared/short-link';

interface InsertShortLinkButtonProps {
  /** 生成成功后回调，参数为完整短链地址（调用方负责插入内容） */
  onInsert: (shortUrl: string) => void;
}

/**
 * 「插入短链」按钮：输入长链接即时生成短链（bizType=custom，可在短链管理中统一治理），
 * 供短信模板、消息广播等内容编辑器嵌入。无 shortlink:link:create 权限时不渲染。
 */
export default function InsertShortLinkButton({ onInsert }: InsertShortLinkButtonProps) {
  const { hasPermission } = usePermission();
  const modal = useEditModal<ShortLink, Record<string, unknown>, Partial<ShortLink>>({
    entityName: '短链',
    save: useSaveShortLink(),
    beforeSave: (values) => ({
      targetUrl: values.targetUrl as string,
      title: values.title ? (values.title as string) : null,
    }),
    onSaved: (saved) => onInsert(saved.shortUrl),
    successMessage: () => '短链已生成并插入内容',
    labelWidth: 72,
  });

  if (!hasPermission('shortlink:link:create')) return null;

  return (
    <>
      <Button size="small" theme="borderless" type="tertiary" icon={<Link2 size={13} />} onClick={modal.openCreate}>
        插入短链
      </Button>
      <AppModal {...modal.modalProps} title="插入短链" width={520}>
        <Form key={modal.formKey} {...modal.formProps}>
          <Form.Input
            field="targetUrl" label="长链接" placeholder="https://example.com/very/long/url"
            rules={[
              { required: true, message: '长链接不能为空' },
              { validator: (_r, v: string) => !v || /^https?:\/\//.test(v), message: '仅支持 http/https 地址' },
            ]}
          />
          <Form.Input field="title" label="标题" placeholder="便于在短链管理中识别（选填）" />
        </Form>
      </AppModal>
    </>
  );
}
