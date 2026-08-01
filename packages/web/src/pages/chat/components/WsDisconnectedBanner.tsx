import { Typography } from '@douyinfe/semi-ui';
import { AlertCircle } from 'lucide-react';

const { Text } = Typography;

/** WebSocket 断线提示条；marginBottom 未传时不占外边距（与原两处内联样式一致） */
export function WsDisconnectedBanner({ marginBottom }: Readonly<{ marginBottom?: number }>) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom,
        padding: '8px 10px', borderRadius: 'var(--semi-border-radius-medium)',
        background: 'var(--semi-color-warning-light-default)',
        border: '1px solid var(--semi-color-warning-light-active)',
        color: 'var(--semi-color-warning)',
      }}
    >
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      <Text style={{ flex: 1, fontSize: 12, color: 'inherit' }}>
        实时连接已断开，正在自动重连。重连期间仍可发送消息，但新消息可能会延迟同步。
      </Text>
    </div>
  );
}
