/** 单图上传字段（受控）：已上传时展示预览缩略图 + 悬浮删除按钮，未上传时展示上传按钮。 */
import { Button, Space, Toast, Upload } from '@douyinfe/semi-ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { fileContract } from '@zenith/shared/platform';
import { config } from '@/config';
import { urlOf } from '@/lib/contract-query';
import { request } from '@/utils/request';

const UPLOAD_ACTION = `${config.apiBaseUrl}${urlOf(fileContract.uploadOne)}`;

/** 从统一响应包络中取出上传后的文件 URL；失败返回 null */
function extractUploadUrl(res: unknown): string | null {
  const r = res as { code?: number; data?: { url?: string } };
  return r?.code === 0 && r.data?.url ? r.data.url : null;
}

interface ImageUploadFieldProps {
  /** 当前图片 URL，空串表示未上传 */
  readonly value: string;
  readonly onChange: (url: string) => void;
  /** 上传按钮文案，同时用于成功/失败提示（如「图片」「封面」） */
  readonly label?: string;
  /** 预览图尺寸；默认按内容自适应且限制最大边长 */
  readonly previewStyle?: React.CSSProperties;
  readonly accept?: string;
}

const DEFAULT_PREVIEW_STYLE: React.CSSProperties = { maxWidth: 240, maxHeight: 180 };

export function ImageUploadField({
  value,
  onChange,
  label = '图片',
  previewStyle = DEFAULT_PREVIEW_STYLE,
  accept = 'image/*',
}: ImageUploadFieldProps) {
  return (
    <Space align="start">
      {value
        ? (
          <div style={{ position: 'relative' }}>
            <img
              src={value}
              alt={label}
              style={{
                ...previewStyle,
                objectFit: 'cover',
                borderRadius: 'var(--semi-border-radius-medium)',
                border: '1px solid var(--semi-color-border)',
              }}
            />
            <Button
              theme="borderless"
              type="danger"
              size="small"
              icon={<Trash2 size={14} />}
              aria-label={`删除${label}`}
              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,0.8)' }}
              onClick={() => onChange('')}
            />
          </div>
        )
        : (
          <Upload
            action={UPLOAD_ACTION}
            headers={() => request.authHeaders()}
            name="file"
            accept={accept}
            limit={1}
            showUploadList={false}
            onSuccess={(res) => {
              const url = extractUploadUrl(res);
              if (url) {
                onChange(url);
                Toast.success(`${label}已上传`);
              } else {
                Toast.error(`${label}上传失败`);
              }
            }}
          >
            <Button icon={<ImagePlus size={14} />}>上传{label}</Button>
          </Upload>
        )}
    </Space>
  );
}
