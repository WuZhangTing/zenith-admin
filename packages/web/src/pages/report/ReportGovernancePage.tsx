import { TabPane, Tabs } from '@douyinfe/semi-ui';
import GovernanceCapacityTab from './governance/GovernanceCapacityTab';
import GovernanceEnvironmentTab from './governance/GovernanceEnvironmentTab';
import GovernanceResourceTab from './governance/GovernanceResourceTab';
import GovernanceSlaTab from './governance/GovernanceSlaTab';
import { GovernanceApprovalTab, GovernanceTransferTab } from './governance/GovernanceWorkflowTabs';

import { useUrlTabState } from '@/hooks/useUrlTabState';
export default function ReportGovernancePage() {
  const [activeTab, setActiveTab] = useUrlTabState(['resources', 'approvals', 'transfers', 'environments', 'capacity', 'sla'] as const, 'resources');
  return (
    <div className="page-container page-tabs-page">
      <Tabs collapsible="auto" type="line" activeKey={activeTab} onChange={(k) => setActiveTab(k as typeof activeTab)}>
        <TabPane tab="目录与资源权限" itemKey="resources"><GovernanceResourceTab /></TabPane>
        <TabPane tab="发布审批" itemKey="approvals"><GovernanceApprovalTab /></TabPane>
        <TabPane tab="所有权转移" itemKey="transfers"><GovernanceTransferTab /></TabPane>
        <TabPane tab="环境与发布" itemKey="environments"><GovernanceEnvironmentTab /></TabPane>
        <TabPane tab="配额与成本" itemKey="capacity"><GovernanceCapacityTab /></TabPane>
        <TabPane tab="SLA 与违规" itemKey="sla"><GovernanceSlaTab /></TabPane>
      </Tabs>
    </div>
  );
}
