import { useEffect, useState } from 'react';
import { Button, Select, Form, Toast, Spin, Switch, CheckboxGroup, Tag, Space } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Trash2 } from 'lucide-react';
import type { TenantPackage } from '@zenith/shared/identity';
import { LICENSE_FEATURE_LABELS, LICENSE_FEATURE_OPTIONS } from '@zenith/shared/licensing';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { useDictItems } from '@/hooks/useDictItems';
import { useListSearch } from '@/hooks/useListSearch';
import {
  tenantPackageKeys,
  useAssignTenantPackageFeatures,
  useDeleteTenantPackages,
  useSaveTenantPackage,
  useTenantPackageDetail,
  useTenantPackageList,
} from '@/hooks/queries/tenant-packages';
import { createdAtColumn, renderEllipsis } from '../../../utils/table-columns';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

interface SearchParams {
  keyword: string;
  status: string;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '' };

export default function TenantPackagesPage() {
  const { hasPermission } = usePermission();
  const { items: statusItems } = useDictItems('common_status');

  // draft：搜索区输入中的条件；submitted：点击查询后实际生效的条件（进入 query key）
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: tenantPackageKeys.lists });
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const listQuery = useTenantPackageList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  // 新增/编辑弹窗：详情到达时由 useEditModal 自动重挂载表单
  const saveMutation = useSaveTenantPackage();
  const modal = useEditModal<TenantPackage>({
    entityName: '套餐',
    save: saveMutation,
    useDetail: useTenantPackageDetail,
    defaults: { status: 'enabled' },
    labelWidth: 72,
  });

  // 分配功能弹窗
  const [featureModalVisible, setFeatureModalVisible] = useState(false);
  const [featurePackage, setFeaturePackage] = useState<TenantPackage | null>(null);
  const [checkedFeatures, setCheckedFeatures] = useState<string[]>([]);
  const featureDetailQuery = useTenantPackageDetail(featurePackage?.id, featureModalVisible);

  useEffect(() => {
    if (featureModalVisible) setCheckedFeatures(featureDetailQuery.data?.features ?? []);
  }, [featureModalVisible, featureDetailQuery.data]);

  const toggleStatusMutation = useSaveTenantPackage();
  const deleteMutation = useDeleteTenantPackages();
  const assignFeaturesMutation = useAssignTenantPackageFeatures();

  const togglingStatusId = toggleStatusMutation.isPending ? (toggleStatusMutation.variables?.id ?? null) : null;

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  };

  const handleBatchDelete = () => {
    confirmDelete({
      title: `确认删除选中的 ${selectedRowKeys.length} 个套餐？`,
      content: '删除后无法恢复，已绑定该套餐的租户将解除关联。',
      onOk: async () => {
        await deleteMutation.mutateAsync(selectedRowKeys);
        Toast.success('批量删除成功');
        setSelectedRowKeys([]);
      },
    });
  };

  const handleToggleStatus = (pkg: TenantPackage, newStatus: 'enabled' | 'disabled') => {
    toggleStatusMutation.mutate(
      { id: pkg.id, values: { status: newStatus } },
      { onSuccess: () => Toast.success(newStatus === 'enabled' ? '已启用' : '已禁用') },
    );
  };

  function openFeatureModal(pkg: TenantPackage) {
    setFeaturePackage(pkg);
    setFeatureModalVisible(true);
  }

  const handleAssignFeatures = async () => {
    if (!featurePackage) return;
    await assignFeaturesMutation.mutateAsync({ id: featurePackage.id, features: checkedFeatures });
    Toast.success('套餐功能已更新');
    setFeatureModalVisible(false);
  };

  const columns: ColumnProps<TenantPackage>[] = [
    { title: '套餐名称', dataIndex: 'name', width: 180, render: renderEllipsis },
    {
      title: '已授权功能',
      dataIndex: 'features',
      width: 320,
      render: (features?: string[]) => {
        if (!features || features.length === 0) return <span style={{ color: 'var(--semi-color-text-2)' }}>仅核心功能</span>;
        const shown = features.slice(0, 3);
        return (
          <Space spacing={4} style={{ whiteSpace: 'nowrap' }}>
            {shown.map((f) => (
              <Tag key={f} size="small" color="blue">{LICENSE_FEATURE_LABELS[f as keyof typeof LICENSE_FEATURE_LABELS] ?? f}</Tag>
            ))}
            {features.length > shown.length && <Tag size="small">+{features.length - shown.length}</Tag>}
          </Space>
        );
      },
    },
    { title: '席位上限', dataIndex: 'quotas', width: 100, align: 'center', render: (q?: { maxUsers?: number } | null) => q?.maxUsers ?? '不限' },
    { title: '备注', dataIndex: 'remark', width: 200, render: renderEllipsis },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      align: 'center',
      fixed: 'right',
      render: (v: string, record: TenantPackage) => (
        <Switch
          size="small"
          checked={v === 'enabled'}
          loading={togglingStatusId === record.id}
          disabled={!hasPermission('system:tenant-package:update')}
          onChange={(checked: boolean) => handleToggleStatus(record, checked ? 'enabled' : 'disabled')}
        />
      ),
    },
    createOperationColumn<TenantPackage>({
      width: 240,
      desktopInlineKeys: ['edit', 'features', 'delete'],
      actions: (row) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !hasPermission('system:tenant-package:update'),
          onClick: () => modal.openEdit(row),
        },
        {
          key: 'features',
          label: '分配功能',
          hidden: !hasPermission('system:tenant-package:assign'),
          onClick: () => openFeatureModal(row),
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('system:tenant-package:delete'),
          onClick: () => {
            confirmDelete({
              title: '确认删除此套餐？',
              content: '删除后已绑定该套餐的租户将解除关联。',
              onOk: () => handleDelete(row.id),
            });
          },
        },
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="搜索套餐名称" value={draftParams.keyword} onChange={(v) => setDraftParams((prev) => ({ ...prev, keyword: v }))} onSearch={handleSearch} />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="请选择状态"
      value={draftParams.status || undefined}
      onChange={(value) => setDraftParams((prev) => ({ ...prev, status: (value as string) ?? '' }))}
      style={{ width: 140, maxWidth: '100%' }}
      optionList={[
        { value: '', label: '全部状态' },
        ...statusItems.map((item) => ({ value: item.value, label: item.label })),
      ]}
    />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderBatchDeleteButton = () => selectedRowKeys.length > 0 && hasPermission('system:tenant-package:delete') ? (
    <Button type="danger" theme="light" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>
      批量删除 ({selectedRowKeys.length})
    </Button>
  ) : null;
  const renderCreateButton = () => hasPermission('system:tenant-package:create') ? (
    <CreateButton onClick={modal.openCreate} />
  ) : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderStatusFilter()}
            {renderSearchButton()}
            {renderResetButton()}
            {renderBatchDeleteButton()}
            {renderCreateButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderKeywordSearch()}
            {renderSearchButton()}
            {renderCreateButton()}
          </>
        )}
        mobileFilters={renderStatusFilter()}
        mobileActions={renderBatchDeleteButton()}
        filterTitle="套餐筛选"
        actionTitle="套餐操作"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys((keys as number[]) ?? []),
        }}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={520}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form {...modal.formProps}>
            <Form.Input field="name" label="套餐名称" placeholder="请输入套餐名称" rules={[{ required: true, message: '请输入套餐名称' }]} />
            <Form.InputNumber
              field="quotas.maxUsers"
              label="席位上限"
              placeholder="留空表示不限制"
              min={1}
              style={{ width: '100%' }}
            />
            <Form.Select
              field="status"
              label="状态"
              style={{ width: '100%' }}
              optionList={statusItems.map((item) => ({ value: item.value, label: item.label }))}
              placeholder="请选择状态"
            />
            <Form.TextArea field="remark" label="备注" placeholder="请输入备注" rows={3} />
          </Form>
        </Spin>
      </AppModal>

      <AppModal
        title={`分配功能 — ${featurePackage?.name ?? ''}`}
        visible={featureModalVisible}
        onCancel={() => setFeatureModalVisible(false)}
        onOk={handleAssignFeatures}
        okButtonProps={{ disabled: !featureDetailQuery.isSuccess, loading: assignFeaturesMutation.isPending }}
        width={560}
      >
        <Spin spinning={featureDetailQuery.isFetching}>
          <div style={{ marginBottom: 12, color: 'var(--semi-color-text-2)', fontSize: 13 }}>
            核心功能（组织架构、系统管理、消息、文件、任务等）始终可用，无需分配；此处勾选的是可按套餐授权的增值功能模块。
          </div>
          <CheckboxGroup
            options={LICENSE_FEATURE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={checkedFeatures}
            onChange={(values) => setCheckedFeatures((values ?? []) as string[])}
            direction="horizontal"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
          />
        </Spin>
      </AppModal>
    </div>
  );
}
