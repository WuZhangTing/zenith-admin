import { Banner, Button } from '@douyinfe/semi-ui';
import { Wrench } from 'lucide-react';

// 维护模式横幅（仅超级管理员可见，条件由父级控制）
export function MaintenanceBanner({
  maintenanceBannerMsg,
  disablingMaintenance,
  handleDisableMaintenance,
}: Readonly<{
  maintenanceBannerMsg: string;
  disablingMaintenance: boolean;
  handleDisableMaintenance: () => Promise<void>;
}>) {
  return (
    <Banner
      type="warning"
      icon={<Wrench size={15} />}
      style={{ borderRadius: 0 }}
      description={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>
            系统当前处于 <strong>维护模式</strong>，普通用户无法访问接口。
            {maintenanceBannerMsg && <span style={{ marginLeft: 8, color: 'var(--semi-color-text-2)' }}>{maintenanceBannerMsg}</span>}
          </span>
          <Button size="small" theme="solid" type="warning" loading={disablingMaintenance} onClick={handleDisableMaintenance}>
            关闭维护模式
          </Button>
        </span>
      }
      closeIcon={null}
    />
  );
}
