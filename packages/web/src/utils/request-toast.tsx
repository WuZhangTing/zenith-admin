import { Toast, Typography } from '@douyinfe/semi-ui';

type RequestToastType = 'error' | 'warning';

const REQUEST_TOAST_DURATION = 4;

let activeToastId: string | null = null;
let lastToastKey = '';

function showRequestToast(type: RequestToastType, content: string, reqId?: string | null): void {
  const key = `${type}:${content}:${reqId ?? ''}`;

  // 同内容且 toast 仍可见：直接丢弃，避免高频同错误下反复关旧开新造成闪烁
  if (activeToastId && key === lastToastKey) {
    return;
  }

  if (activeToastId) {
    Toast.close(activeToastId);
    activeToastId = null;
  }

  lastToastKey = key;

  let toastId = '';
  const options = {
    // 服务端错误附链路 ID（可复制），用户报障时一键提供给管理员按链路排查
    content: reqId
      ? (
          <span>
            {content}
            <Typography.Text
              size="small"
              type="tertiary"
              copyable={{ content: reqId }}
              style={{ display: 'block', marginTop: 2 }}
            >
              链路ID: {reqId.slice(0, 8)}…
            </Typography.Text>
          </span>
        )
      : content,
    duration: REQUEST_TOAST_DURATION,
    onClose: () => {
      if (activeToastId === toastId) {
        activeToastId = null;
      }
    },
  };

  toastId = type === 'error' ? Toast.error(options) : Toast.warning(options);
  activeToastId = toastId;
}

export function showRequestErrorToast(content: string, reqId?: string | null): void {
  showRequestToast('error', content, reqId);
}

export function showRequestWarningToast(content: string): void {
  showRequestToast('warning', content);
}
