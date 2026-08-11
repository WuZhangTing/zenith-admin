import { useState } from 'react';
import { Banner, Button, Col, Empty, Form, Row, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { ReportEnvironment, ReportEnvironmentPromotion, ReportPromotionStatus, ReportResourceType } from '@zenith/shared/report';
import { Rocket } from 'lucide-react';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { useReportAssetCatalog } from '@/hooks/queries/report-assets';
import {
  useCreateReportPromotion,
  useDeleteReportEnvironment,
  useReportEnvironmentList,
  useReportPromotionList,
  useSaveReportEnvironment,
  useTransitionReportPromotion,
} from '@/hooks/queries/report-governance';
import { formatDateTime } from '@/utils/date';
import { parseJsonObject } from '../report-platform-utils';
import { REPORT_RESOURCE_TYPE_OPTIONS, reportResourceTypeLabel } from '../report-platform-options';
import { CreateButton } from '@/components/toolbar-controls';
import { confirmDanger, confirmDelete } from '@/utils/confirm';

const environmentKindOptions = [
  { value: 'development', label: '开发' },
  { value: 'testing', label: '测试' },
  { value: 'staging', label: '预发布' },
  { value: 'production', label: '生产' },
];
const promotionStatusColor: Record<ReportPromotionStatus, 'grey' | 'blue' | 'green' | 'red' | 'orange'> = {
  pending: 'orange', approved: 'blue', deploying: 'blue', succeeded: 'green',
  failed: 'red', cancelled: 'grey', rolled_back: 'grey',
};

export default function GovernanceEnvironmentTab() {
  const { hasPermission } = usePermission();
  const { page, pageSize, buildPagination } = usePagination();
  const [promotionType, setPromotionType] = useState<ReportResourceType>('dashboard');

  const environmentsQuery = useReportEnvironmentList();
  const promotionsQuery = useReportPromotionList({ page, pageSize });
  const assetsQuery = useReportAssetCatalog({ page: 1, pageSize: 100, types: promotionType });
  const saveEnvironmentMutation = useSaveReportEnvironment();
  const deleteEnvironmentMutation = useDeleteReportEnvironment();
  const createPromotionMutation = useCreateReportPromotion();
  const transitionMutation = useTransitionReportPromotion();

  const environmentModal = useEditModal<ReportEnvironment, Record<string, unknown>>({
    entityName: '环境',
    save: saveEnvironmentMutation,
    defaults: { kind: 'development', config: '{}', status: 'enabled', isDefault: false },
    toValues: (record) => ({ ...record, config: JSON.stringify(record.config, null, 2) }),
    beforeSave: (values) => ({
      ...values,
      description: values.description || null,
      baseUrl: values.baseUrl || null,
      config: parseJsonObject(String(values.config ?? '{}'), '环境配置'),
      isDefault: Boolean(values.isDefault),
    }),
    successMessage: ({ isEdit }) => isEdit ? '环境已更新' : '环境已创建',
  });
  const openEnvironment = (record?: ReportEnvironment) => {
    if (record) environmentModal.openEdit(record);
    else environmentModal.openCreate();
  };
  const promotionModal = useEditModal<ReportEnvironmentPromotion, Record<string, unknown>, Parameters<typeof createPromotionMutation.mutateAsync>[0]>({
    save: {
      isPending: createPromotionMutation.isPending,
      mutateAsync: ({ values }) => createPromotionMutation.mutateAsync(values),
    },
    defaults: { resourceType: 'dashboard', sourceRevision: 1, sourceSnapshot: '{}' },
    labelWidth: 100,
    beforeSave: (values) => ({
        resourceType: values.resourceType as ReportResourceType,
        resourceId: Number(values.resourceId),
        sourceEnvironmentId: Number(values.sourceEnvironmentId),
        targetEnvironmentId: Number(values.targetEnvironmentId),
        sourceRevision: Number(values.sourceRevision),
        sourceSnapshot: parseJsonObject(String(values.sourceSnapshot), '来源快照'),
    }),
    successMessage: () => '环境发布已创建',
  });
  const openPromotion = () => {
    setPromotionType('dashboard');
    promotionModal.openCreate();
  };
  const transition = (record: ReportEnvironmentPromotion, action: 'approve' | 'deploy' | 'cancel' | 'rollback') => {
    const dangerous = ['cancel', 'rollback'].includes(action);
    confirmDanger({
      title: `${action === 'rollback' ? '回滚' : action === 'cancel' ? '取消' : action === 'approve' ? '审批' : '部署'}该环境发布？`,
      content: `${record.sourceEnvironmentName ?? record.sourceEnvironmentId} → ${record.targetEnvironmentName ?? record.targetEnvironmentId}`,
      okButtonProps: dangerous ? { type: 'danger', theme: 'solid' } : undefined,
      onOk: async () => {
        await transitionMutation.mutateAsync({ id: record.id, values: { action, expectedStatus: record.status } });
        Toast.success('发布状态已更新');
      },
    });
  };

  const environmentColumns: ColumnProps<ReportEnvironment>[] = [
    { title: '环境名称', dataIndex: 'name', width: 180 },
    { title: '编码', dataIndex: 'code', width: 130 },
    { title: '类型', dataIndex: 'kind', width: 110, render: (v) => environmentKindOptions.find((item) => item.value === v)?.label ?? v },
    { title: '访问地址', dataIndex: 'baseUrl', width: 240, render: (v) => v || '—' },
    { title: '默认环境', dataIndex: 'isDefault', width: 100, render: (v) => v ? <Tag color="blue">默认</Tag> : '—' },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (v) => formatDateTime(v) },
    { title: '状态', dataIndex: 'status', width: 100, fixed: 'right', render: (v) => <Tag color={v === 'enabled' ? 'green' : 'grey'}>{v}</Tag> },
    createOperationColumn<ReportEnvironment>({
      width: 150,
      desktopInlineKeys: ['edit'],
      actions: (record) => [
        { key: 'edit', label: '编辑', hidden: !hasPermission('report:environment:update'), onClick: () => openEnvironment(record) },
        {
          key: 'delete', label: '删除', danger: true, hidden: !hasPermission('report:environment:delete'),
          onClick: () => { confirmDelete({
            title: `删除环境「${record.name}」？`,
            content: '默认环境或存在发布记录的环境无法删除。',
            onOk: async () => { await deleteEnvironmentMutation.mutateAsync(record.id); Toast.success('环境已删除'); },
          }); },
        },
      ],
    }),
  ];
  const promotionColumns: ColumnProps<ReportEnvironmentPromotion>[] = [
    { title: '资源', dataIndex: 'resourceName', width: 190, render: (v, r) => v || `${reportResourceTypeLabel(r.resourceType)} #${r.resourceId}` },
    { title: '来源环境', dataIndex: 'sourceEnvironmentName', width: 130, render: (v, r) => v || `#${r.sourceEnvironmentId}` },
    { title: '目标环境', dataIndex: 'targetEnvironmentName', width: 130, render: (v, r) => v || `#${r.targetEnvironmentId}` },
    { title: '来源修订', dataIndex: 'sourceRevision', width: 100 },
    { title: '开始时间', dataIndex: 'startedAt', width: 180, render: (v) => v ? formatDateTime(v) : '—' },
    { title: '错误', dataIndex: 'errorMessage', width: 220, render: (v) => v || '—' },
    { title: '状态', dataIndex: 'status', width: 110, fixed: 'right', render: (v: ReportPromotionStatus) => <Tag color={promotionStatusColor[v]}>{v}</Tag> },
    createOperationColumn<ReportEnvironmentPromotion>({
      width: 170,
      desktopInlineKeys: ['deploy'],
      actions: (record) => [
        { key: 'approve', label: '审批通过', hidden: !hasPermission('report:environment:promote') || record.status !== 'pending', onClick: () => transition(record, 'approve') },
        { key: 'deploy', label: '部署', hidden: !hasPermission('report:environment:promote') || record.status !== 'approved', onClick: () => transition(record, 'deploy') },
        { key: 'cancel', label: '取消', danger: true, hidden: !hasPermission('report:environment:promote') || !['pending', 'approved'].includes(record.status), onClick: () => transition(record, 'cancel') },
        { key: 'rollback', label: '回滚', danger: true, hidden: !hasPermission('report:environment:promote') || record.status !== 'succeeded', onClick: () => transition(record, 'rollback') },
      ],
    }),
  ];

  return (
    <>
      <SearchToolbar>
        {hasPermission('report:environment:create') ? <CreateButton onClick={() => openEnvironment()}>新增环境</CreateButton> : null}
        {hasPermission('report:environment:promote') ? <Button icon={<Rocket size={14} />} onClick={openPromotion}>创建发布</Button> : null}
      </SearchToolbar>
      {environmentsQuery.isError && <Banner type="danger" description="环境列表加载失败" />}
      <ConfigurableTable bordered rowKey="id" columns={environmentColumns} dataSource={environmentsQuery.data ?? []} loading={environmentsQuery.isFetching} empty={<Empty title="暂无环境" />} pagination={false} onRefresh={() => void environmentsQuery.refetch()} refreshLoading={environmentsQuery.isFetching} />
      <Typography.Title heading={5} style={{ marginTop: 20 }}>发布与回滚历史</Typography.Title>
      {promotionsQuery.isError && <Banner type="danger" description="环境发布历史加载失败" />}
      <ConfigurableTable bordered rowKey="id" columns={promotionColumns} dataSource={promotionsQuery.data?.list ?? []} loading={promotionsQuery.isFetching} empty={<Empty title="暂无环境发布" />} pagination={buildPagination(promotionsQuery.data?.total ?? 0)} onRefresh={() => void promotionsQuery.refetch()} refreshLoading={promotionsQuery.isFetching} />

      <AppModal {...environmentModal.modalProps} width={650}>
        <Form {...environmentModal.formProps}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Input field="name" label="环境名称" rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.Input field="code" label="环境编码" disabled={environmentModal.isEdit} rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.Select field="kind" label="环境类型" style={{ width: '100%' }} optionList={environmentKindOptions} rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} /></Col>
          </Row>
          <Form.Input field="baseUrl" label="环境地址" />
          <Form.TextArea field="description" label="说明" autosize rows={2} />
          <Form.TextArea field="config" label="配置 JSON" autosize rows={5} />
          <Form.Switch field="isDefault" label="默认环境" />
        </Form>
      </AppModal>

      <AppModal {...promotionModal.modalProps} title="创建环境发布" width={680}>
        <Form {...promotionModal.formProps}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Select field="resourceType" label="资源类型" style={{ width: '100%' }} optionList={REPORT_RESOURCE_TYPE_OPTIONS} rules={[{ required: true }]} onChange={(v) => setPromotionType(v as ReportResourceType)} /></Col>
            <Col xs={24} md={12}><Form.Select field="resourceId" label="资源" filter style={{ width: '100%' }} optionList={(assetsQuery.data?.list ?? []).map((item) => ({ value: item.resourceId, label: item.name }))} rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.Select field="sourceEnvironmentId" label="来源环境" style={{ width: '100%' }} optionList={(environmentsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.Select field="targetEnvironmentId" label="目标环境" style={{ width: '100%' }} optionList={(environmentsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))} rules={[{ required: true }]} /></Col>
            <Col xs={24} md={12}><Form.InputNumber field="sourceRevision" label="来源修订" min={1} style={{ width: '100%' }} rules={[{ required: true }]} /></Col>
          </Row>
          <Form.TextArea field="sourceSnapshot" label="来源快照" autosize rows={7} rules={[{ required: true }]} />
        </Form>
      </AppModal>
    </>
  );
}
