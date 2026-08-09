import { useEffect, useState } from 'react';
import { Button, Form, Modal, Select, Space, Spin, Switch, Toast, SideSheet, Empty } from '@douyinfe/semi-ui';
import { Trash2, Users } from 'lucide-react';
import type { Position } from '@zenith/shared/identity';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useDictItems } from '@/hooks/useDictItems';
import { UserTransferSelect } from '@/components/UserTransferSelect';
import type { UserTransferUser } from '@/components/UserTransferSelect';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { usePermission } from '@/hooks/usePermission';
import { SearchToolbar } from '@/components/SearchToolbar';
import { UserPreviewCell } from '@/components/UserPreviewCell';
import ExportButton from '@/components/ExportButton';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { createdAtColumn, renderEllipsis } from '../../../utils/table-columns';
import { useFlatDepartments } from '@/hooks/queries/departments';
import {
  useAssignPositionMembers,
  useDeletePositions,
  positionKeys,
  usePositionDetail,
  usePositionList,
  usePositionMembers,
  useSavePosition,
} from '@/hooks/queries/positions';
import { useAllUsers } from '@/hooks/queries/users';
import { useEditModal } from '@/hooks/useEditModal';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { DateRangeFilter, KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

interface SearchParams {
  keyword: string;
  status: string;
  timeRange: [Date, Date] | null;
}

const defaultSearchParams: SearchParams = {
  keyword: '',
  status: '',
  timeRange: null,
};

export default function PositionsPage() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: positionKeys.lists });
  const listQuery = usePositionList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const { items: statusItems } = useDictItems('common_status');

  // 成员管理
  const allUsersQuery = useAllUsers();
  const departmentsQuery = useFlatDepartments();
  const allUsers: UserTransferUser[] = allUsersQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const [memberSheetVisible, setMemberSheetVisible] = useState(false);
  const [memberPosition, setMemberPosition] = useState<Position | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const membersQuery = usePositionMembers(memberPosition?.id, memberSheetVisible);
  const saveMutation = useSavePosition();
  const positionModal = useEditModal<Position>({
    entityName: '岗位',
    save: saveMutation,
    useDetail: usePositionDetail,
    defaults: { sort: 0, status: 'enabled' },
    toValues: (position) => ({
      name: position.name,
      code: position.code,
      sort: position.sort,
      status: position.status,
      remark: position.remark,
    }),
  });
  const toggleStatusMutation = useSavePosition();
  const deleteMutation = useDeletePositions();
  const assignMembersMutation = useAssignPositionMembers();
  const togglingStatusId = toggleStatusMutation.isPending ? (toggleStatusMutation.variables?.id ?? null) : null;

  useEffect(() => {
    if (memberSheetVisible) setMemberIds((membersQuery.data ?? []).map((m) => m.id));
  }, [memberSheetVisible, membersQuery.data]);

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  };

  const handleToggleStatus = async (pos: Position, newStatus: 'enabled' | 'disabled') => {
    if (newStatus === 'disabled') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: `确认停用岗位「${pos.name}」？`,
          content: '停用后该岗位将不可选择。',
          okButtonProps: { type: 'danger', theme: 'solid' },
          okText: '确认停用',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }
    toggleStatusMutation.mutate(
      { id: pos.id, values: { status: newStatus } },
      { onSuccess: () => Toast.success(newStatus === 'enabled' ? '已启用' : '已停用') },
    );
  };

  const handleBatchDelete = () => {
    confirmDelete({
      title: `确认删除选中的 ${selectedRowKeys.length} 个岗位？`,
      content: '删除后无法恢复，请确认操作',
      onOk: async () => {
        await deleteMutation.mutateAsync(selectedRowKeys);
        Toast.success('删除成功');
        setSelectedRowKeys([]);
      },
    });
  };

  const openMembers = (pos: Position) => {
    setMemberPosition(pos);
    setMemberSheetVisible(true);
  };

  const handleSaveMembers = async () => {
    if (!memberPosition) return;
    await assignMembersMutation.mutateAsync({ id: memberPosition.id, userIds: memberIds });
    Toast.success('保存成功');
    setMemberSheetVisible(false);
  };

  const columns: ColumnProps<Position>[] = [
    { title: '岗位名称', dataIndex: 'name', width: 200, render: renderEllipsis },
    { title: '岗位编码', dataIndex: 'code', width: 180, render: renderEllipsis },
    { title: '排序', dataIndex: 'sort', width: 90 },
    {
      title: '成员', dataIndex: 'userPreview', width: 150,
      render: (_: unknown, record: Position) => <UserPreviewCell preview={record.userPreview} count={record.userCount} scope={{ type: 'position', id: record.id, name: record.name }} />,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 200,
      render: renderEllipsis,
    },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      fixed: 'right',
      render: (value: string, record: Position) => (
        <Switch
          size="small"
          checked={value === 'enabled'}
          loading={togglingStatusId === record.id}
          disabled={!hasPermission('system:position:update')}
          onChange={(checked: boolean) => void handleToggleStatus(record, checked ? 'enabled' : 'disabled')}
        />
      ),
    },
    createOperationColumn<Position>({
      width: 220,
      actions: (record) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !hasPermission('system:position:update'),
          onClick: () => { positionModal.openEdit(record); },
        },
        {
          key: 'members',
          label: '成员',
          hidden: !hasPermission('system:position:update'),
          onClick: () => { void openMembers(record); },
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('system:position:delete'),
          onClick: () => {
            confirmDelete({
              title: '确定要删除该岗位吗？',
              onOk: () => handleDelete(record.id),
            });
          },
        },
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="搜索岗位名称/编码" value={draftParams.keyword} onChange={(value) => setDraftParams((prev) => ({ ...prev, keyword: value }))} onSearch={handleSearch} width={240} />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="请选择状态"
      value={draftParams.status || undefined}
      onChange={(value) => setDraftParams((prev) => ({ ...prev, status: (value as string) ?? '' }))}
      style={{ width: 140 }}
      optionList={[
        { value: '', label: '全部状态' },
        ...statusItems.map((item) => ({ value: item.value, label: item.label })),
      ]}
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter value={draftParams.timeRange ?? undefined} onChange={(value) => setDraftParams((prev) => ({ ...prev, timeRange: value ? (value as [Date, Date]) : null }))} />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderCreateButton = () => hasPermission('system:position:create') ? (
    <CreateButton onClick={positionModal.openCreate} />
  ) : null;

  const buildExportQuery = () => ({
    ...(submittedParams.keyword ? { keyword: submittedParams.keyword } : {}),
    ...(submittedParams.status ? { status: submittedParams.status } : {}),
    ...(submittedParams.timeRange
      ? formatDateTimeRangeForApi(submittedParams.timeRange)
      : {}),
  });

  const renderExportButtons = () => <ExportButton entity="system.positions" query={buildExportQuery()} />;

  const renderMobileExportActions = () => <ExportButton entity="system.positions" query={buildExportQuery()} variant="flat" />;

  const renderBatchDeleteButton = () => selectedRowKeys.length > 0 && hasPermission('system:position:delete') ? (
    <Button type="danger" theme="light" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>
      批量删除 ({selectedRowKeys.length})
    </Button>
  ) : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderStatusFilter()}
            {renderTimeRangeFilter()}
            {renderSearchButton()}
            {renderResetButton()}
          </>
        )}
        actions={(
          <>
            {renderExportButtons()}
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
        mobileFilters={(
          <>
            {renderStatusFilter()}
            {renderTimeRangeFilter()}
          </>
        )}
        mobileActions={(
          <>
            {renderMobileExportActions()}
            {renderBatchDeleteButton()}
          </>
        )}
        filterTitle="岗位筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data}
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowKey="id"
        size="small"
        pagination={buildPagination(total)}
        empty="暂无数据"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
      />

      <AppModal {...positionModal.modalProps} width={520}>
        <Spin spinning={positionModal.detailLoading} wrapperClassName="modal-spin-wrapper">
        <Form {...positionModal.formProps}>
          <Form.Input field="name" label="岗位名称" placeholder="请输入岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]} />
          <Form.Input field="code" label="岗位编码" placeholder="请输入岗位编码" rules={[{ required: true, message: '请输入岗位编码' }]} />
          <Form.InputNumber field="sort" label="排序" placeholder="请输入排序" min={0} style={{ width: '100%' }} />
          <Form.Select
            field="status"
            label="状态"
            optionList={statusItems.map((item) => ({ value: item.value, label: item.label }))}
            style={{ width: '100%' }}
            placeholder="请选择状态"
          />
          <Form.TextArea field="remark" label="备注" placeholder="请输入备注" maxCount={256} />
        </Form>
        </Spin>
      </AppModal>

      <SideSheet
        title={
          <Space>
            <Users size={16} />
            <span>成员管理 - {memberPosition?.name}</span>
          </Space>
        }
        visible={memberSheetVisible}
        onCancel={() => setMemberSheetVisible(false)}
        width={720}
        footer={
          <Space>
            <Button onClick={() => setMemberSheetVisible(false)}>取消</Button>
            <Button type="primary" disabled={!membersQuery.isSuccess} loading={assignMembersMutation.isPending} onClick={handleSaveMembers}>保存</Button>
          </Space>
        }
      >
        {allUsers.length === 0 ? (
          <Empty title="暂无用户" description="请先创建用户" />
        ) : (
          <UserTransferSelect
            dataSource={allUsers}
            value={memberIds}
            onChange={setMemberIds}
            departments={departments}
          />
        )}
      </SideSheet>
    </div>
  );
}
