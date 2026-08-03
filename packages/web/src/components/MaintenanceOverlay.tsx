import { Button, Typography } from '@douyinfe/semi-ui';
import { Wrench, RefreshCw } from 'lucide-react';
import { usePublicMaintenanceStatus } from '@/hooks/queries/maintenance';

const { Title, Text } = Typography;

interface MaintenanceInfo {
  message: string;
  estimatedEndAt: string | null;
  startedAt: string | null;
}

interface Props {
  info: MaintenanceInfo;
}

export default function MaintenanceOverlay({ info }: Readonly<Props>) {
  // 轮询交给查询本身：本组件只在维护生效期间挂载，卸载即自动停止，
  // 无需手写 setInterval。恢复后 App 依据同一份缓存直接停止渲染本遮罩。
  const { isFetching, refetch } = usePublicMaintenanceStatus({ refetchInterval: 30_000 });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--semi-color-bg-0)',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--semi-color-warning-light-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Wrench size={36} style={{ color: 'var(--semi-color-warning)' }} />
        </div>

        <Title heading={3} style={{ margin: 0 }}>系统维护中</Title>

        <Text
          type="secondary"
          style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 360 }}
        >
          {info.message || '系统正在进行维护升级，请稍后再试。'}
        </Text>

        {info.estimatedEndAt && (
          <div
            style={{
              background: 'var(--semi-color-fill-1)',
              borderRadius: 'var(--semi-border-radius-medium)',
              padding: '10px 20px',
            }}
          >
            <Text type="secondary" size="small">预计恢复时间：</Text>
            <Text strong>{info.estimatedEndAt}</Text>
          </div>
        )}

        <Button
          icon={<RefreshCw size={14} />}
          loading={isFetching}
          onClick={() => void refetch()}
          style={{ marginTop: 8 }}
        >
          检查是否恢复
        </Button>
        <Text type="tertiary" size="small">每 30 秒自动检查一次</Text>
      </div>
    </div>
  );
}
