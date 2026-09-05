import { useEffect, useMemo, useState } from 'react';
import { Banner, Button, Form, Select, Space, Toast, SideSheet, Empty, Tag, Spin, Switch, Typography } from '@douyinfe/semi-ui';
import { RefreshCw, Trash2, Users } from 'lucide-react';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import type { CreateUserGroupInput, User, UserGroup, UserGroupMemberRule, UserGroupRulePreview } from '@zenith/shared/identity';
import { USER_STATUSES, enumValueOf } from '@zenith/shared/core';
import { usePermission } from '@/hooks/usePermission';
import { UserTransferSelect } from '@/components/UserTransferSelect';
import type { UserTransferUser } from '@/components/UserTransferSelect';
import { SearchToolbar } from '@/components/SearchToolbar';
import { UserPreviewCell } from '@/components/UserPreviewCell';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { createdAtColumn, renderEllipsis } from '../../../utils/table-columns';
import { useFlatDepartments } from '@/hooks/queries/departments';
import { useAllPositions } from '@/hooks/queries/positions';
import {
  useAssignUserGroupMembers,
  useAssignUserGroupRoles,
  useDeleteUserGroups,
  useSaveUserGroup,
  userGroupKeys,
  useSyncUserGroup,
  useUserGroupDetail,
  useUserGroupList,
  useUserGroupMembers,
  useUserGroupRulePreview,
  useUserGroupRoles,
} from '@/hooks/queries/user-groups';
import { useAllUsers } from '@/hooks/queries/users';
import { useAllRoles } from '@/hooks/queries/roles';
import { useDictItems } from '@/hooks/useDictItems';
import { useEditModal } from '@/hooks/useEditModal';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { confirmDelete, confirmDangerAsync } from '@/utils/confirm';

interface SearchParams {
  keyword: string;
  status?: string;
}

type SimpleUser = UserTransferUser & {
  email?: string | null;
  departmentId?: number | null;
};

const defaultSearchParams: SearchParams = { keyword: '', status: '' };

export default function UserGroupsPage() {
  const { items: statusItems } = useDictItems('common_status');
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: userGroupKeys.lists });
  const listQuery = useUserGroupList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: enumValueOf(USER_STATUSES, submittedParams.status),
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  // 选项数据
  const allUsersQuery = useAllUsers();
  const departmentsQuery = useFlatDepartments();
  const allUsers: SimpleUser[] = (allUsersQuery.data ?? []).map((u: User) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    email: u.email,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
  }));
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  // 成员管理
  const [memberSheetVisible, setMemberSheetVisible] = useState(false);
  const [memberGroup, setMemberGroup] = useState<UserGroup | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const membersQuery = useUserGroupMembers(memberGroup?.id, memberSheetVisible);
  // 动态组规则预览
  const [rulePreview, setRulePreview] = useState<UserGroupRulePreview | null>(null);
  // 角色分配
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleGroup, setRoleGroup] = useState<UserGroup | null>(null);
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const groupRolesQuery = useUserGroupRoles(roleGroup?.id, roleModalVisible);
  const allRolesQuery = useAllRoles({ enabled: roleModalVisible });
  const saveMutation = useSaveUserGroup();
  const rulePreviewMutation = useUserGroupRulePreview();
  const syncMutation = useSyncUserGroup();
  const positionsQuery = useAllPositions();
  const groupModal = useEditModal<UserGroup, Partial<CreateUserGroupInput>>({
    entityName: '用户组',
    save: saveMutation,
    useDetail: useUserGroupDetail,
    defaults: { status: 'enabled', memberMode: 'static' },
    labelPosition: 'top',
    toValues: (group) => ({
      name: group.name,
      code: group.code,
      description: group.description ?? undefined,
      ownerId: group.ownerId ?? undefined,
      status: group.status,
      memberMode: group.memberMode ?? 'static',
      memberRule: group.memberRule ?? undefined,
    }),
  });
  const toggleStatusMutation = useSaveUserGroup();
  const deleteMutation = useDeleteUserGroups();
  const assignMembersMutation = useAssignUserGroupMembers();
  const assignRolesMutation = useAssignUserGroupRoles();
  const togglingStatusId = toggleStatusMutation.isPending ? (toggleStatusMutation.variables?.id ?? null) : null;

  const departmentTreeData = useMemo<TreeNodeData[]>(() => {
    const nodeMap = new Map<number, TreeNodeData>();
    const rootNodes: TreeNodeData[] = [];

    departments.forEach((item) => {
      nodeMap.set(item.id, {
        key: String(item.id),
        value: item.id,
        label: item.name,
        children: [],
      });
    });

    departments.forEach((item) => {
      const currentNode = nodeMap.get(item.id);
      if (!currentNode) return;

      const parentNode = item.parentId ? nodeMap.get(item.parentId) : undefined;
      if (parentNode) {
        parentNode.children = [...(parentNode.children ?? []), currentNode];
        return;
      }

      rootNodes.push(currentNode);
    });

    return rootNodes;
  }, [departments]);

  useEffect(() => {
    if (memberSheetVisible) setMemberIds((membersQuery.data ?? []).map((m) => m.id));
  }, [memberSheetVisible, membersQuery.data]);

  useEffect(() => {
    if (roleModalVisible) setRoleIds((groupRolesQuery.data ?? []).map((r) => r.id));
  }, [roleModalVisible, groupRolesQuery.data]);

  // 编辑弹窗关闭时清空规则预览，避免下次打开残留上一个组的结果
  useEffect(() => {
    if (!groupModal.modalProps.visible) setRulePreview(null);
  }, [groupModal.modalProps.visible]);

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  };

  const handleToggleStatus = async (group: UserGroup, newStatus: 'enabled' | 'disabled') => {
    if (newStatus === 'disabled') {
      const confirmed = await confirmDangerAsync({
        title: `确认禁用用户组「${group.name}」？`,
        content: '禁用后该用户组将不可选择。',
        okText: '确认禁用',
      });
      if (!confirmed) return;
    }
    toggleStatusMutation.mutate(
      { id: group.id, values: { status: newStatus } },
      { onSuccess: () => Toast.success(newStatus === 'enabled' ? '已启用' : '已禁用') },
    );
  };

  const handleBatchDelete = () => {
    confirmDelete({
      title: `确认删除选中的 ${selectedRowKeys.length} 个用户组？`,
      content: '删除后无法恢复，请确认操作',
      onOk: async () => {
        await deleteMutation.mutateAsync(selectedRowKeys);
        Toast.success('删除成功');
        setSelectedRowKeys([]);
      },
    });
  };

  const openMembers = (group: UserGroup) => {
    setMemberGroup(group);
    setMemberSheetVisible(true);
  };

  const openRoles = (group: UserGroup) => {
    setRoleGroup(group);
    setRoleModalVisible(true);
  };

  const handleSaveRoles = async () => {
    if (!roleGroup) return;
    await assignRolesMutation.mutateAsync({ params: { id: roleGroup.id }, body: { roleIds } });
    Toast.success('角色已更新，组内成员即时生效');
    setRoleModalVisible(false);
    setRoleGroup(null);
  };

  const handleSaveMembers = async () => {
    if (!memberGroup) return;
    await assignMembersMutation.mutateAsync({ params: { id: memberGroup.id }, body: { userIds: memberIds } });
    Toast.success('保存成功');
    setMemberSheetVisible(false);
  };

  const columns: ColumnProps<UserGroup>[] = [
    { title: '用户组名称', dataIndex: 'name', width: 200, render: renderEllipsis },
    { title: '编码', dataIndex: 'code', width: 180, render: renderEllipsis },
    {
      title: '描述', dataIndex: 'description',
      render: renderEllipsis,
    },
    {
      title: '负责人', dataIndex: 'ownerName', width: 120,
      render: (v: string | null | undefined) => v || '—',
    },
    {
      title: '成员模式', dataIndex: 'memberMode', width: 110,
      render: (v: string, record: UserGroup) => v === 'dynamic'
        ? <Tag color="teal">动态{record.ruleSyncedAt ? '' : '（未同步）'}</Tag>
        : <Tag color="grey">静态</Tag>,
    },
    {
      title: '成员', dataIndex: 'memberPreview', width: 150,
      render: (_: unknown, record: UserGroup) => <UserPreviewCell preview={record.memberPreview} count={record.memberCount} scope={{ type: 'userGroup', id: record.id, name: record.name }} />,
    },
    {
      title: '角色', dataIndex: 'roleCount', width: 80, align: 'right',
      render: (v: number | undefined, record: UserGroup) => (
        <Tag color={v ? 'violet' : 'grey'} style={{ cursor: hasPermission('system:user-groups:assign') ? 'pointer' : 'default' }}
          onClick={() => hasPermission('system:user-groups:assign') && openRoles(record)}>
          {v ?? 0}
        </Tag>
      ),
    },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (v: string, record: UserGroup) => (
        <Switch
          size="small"
          checked={v === 'enabled'}
          loading={togglingStatusId === record.id}
          disabled={!hasPermission('system:user-groups:update')}
          onChange={(checked: boolean) => void handleToggleStatus(record, checked ? 'enabled' : 'disabled')}
        />
      ),
    },
    createOperationColumn<UserGroup>({
      width: 240,
      desktopInlineKeys: ['members', 'roles', 'edit'],
      actions: (record) => [
        {
          key: 'members',
          label: '成员',
          hidden: !hasPermission('system:user-groups:assign'),
          onClick: () => { void openMembers(record); },
        },
        {
          key: 'roles',
          label: '角色',
          hidden: !hasPermission('system:user-groups:assign'),
          onClick: () => { void openRoles(record); },
        },
        {
          key: 'sync',
          label: '同步',
          hidden: record.memberMode !== 'dynamic' || !hasPermission('system:user-groups:assign'),
          onClick: () => {
            syncMutation.mutate({ params: { id: record.id } }, { onSuccess: () => Toast.success('成员已按规则同步') });
          },
        },
        {
          key: 'edit',
          label: '编辑',
          hidden: !hasPermission('system:user-groups:update'),
          onClick: () => { groupModal.openEdit(record); },
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('system:user-groups:delete'),
          onClick: () => {
            confirmDelete({
              title: '确定要删除该用户组吗？',
              onOk: () => handleDelete(record.id),
            });
          },
        },
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="搜索名称/编码" value={draftParams.keyword} onChange={(value) => setDraftParams((prev) => ({ ...prev, keyword: value }))} onSearch={handleSearch} width={240} />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(value) => setDraftParams((prev) => ({ ...prev, status: value }))}
    />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderBatchDeleteButton = () => selectedRowKeys.length > 0 && hasPermission('system:user-groups:delete') ? (
    <Button type="danger" theme="light" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>
      批量删除 ({selectedRowKeys.length})
    </Button>
  ) : null;
  const renderCreateButton = () => hasPermission('system:user-groups:create') ? (
    <CreateButton onClick={groupModal.openCreate} />
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
        filterTitle="用户组筛选"
        actionTitle="用户组操作"
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
        pagination={buildPagination(total)}
        empty="暂无数据"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
      />

      <SideSheet
        title={groupModal.modalProps.title}
        visible={groupModal.modalProps.visible}
        onCancel={groupModal.modalProps.onCancel}
        width={520}
        closeOnEsc
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={groupModal.modalProps.onCancel}>取消</Button>
            <Button
              theme="solid"
              type="primary"
              loading={groupModal.modalProps.okButtonProps.loading}
              disabled={groupModal.modalProps.okButtonProps.disabled}
              onClick={() => void groupModal.modalProps.onOk()}
            >
              确定
            </Button>
          </div>
        }
      >
        <Spin spinning={groupModal.detailLoading}>
        <Form key={groupModal.formKey} {...groupModal.formProps}>
          {({ formState }) => {
            const memberMode = (formState.values as { memberMode?: string }).memberMode ?? 'static';
            return (
              <>
                <Form.Input field="name" label="名称" placeholder="请输入用户组名称" rules={[{ required: true, message: '请输入用户组名称' }]} />
                <Form.Input field="code" label="编码" placeholder="字母数字下划线" rules={[
                  { required: true, message: '请输入用户组编码' },
                  { pattern: /^\w+$/, message: '编码只能包含字母、数字和下划线' },
                ]} />
                <Form.Select
                  field="ownerId" label="负责人" placeholder="请选择负责人（可选）"
                  style={{ width: '100%' }} filter showClear
                  optionList={allUsers.map(u => ({ value: u.id, label: `${u.nickname} (${u.username})` }))}
                />
                <Form.Select
                  field="status" label="状态" style={{ width: '100%' }}
                  optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))}
                />
                <Form.RadioGroup
                  field="memberMode" label="成员模式" type="button"
                  extraText={memberMode === 'dynamic'
                    ? '成员由规则自动维护：用户的部门/岗位/状态变化后自动加入或退出，不可手工增删'
                    : '成员由管理员手工维护'}
                >
                  <Form.Radio value="static">静态（手工维护）</Form.Radio>
                  <Form.Radio value="dynamic">动态（按规则自动维护）</Form.Radio>
                </Form.RadioGroup>
                {memberMode === 'dynamic' && (
                  <div style={{
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 'var(--semi-border-radius-medium)',
                    padding: '4px 16px 16px',
                    margin: '12px 0',
                  }}>
                    <Form.TreeSelect
                      field="memberRule.departmentIds" label="命中部门" placeholder="选择部门（可多选）"
                      style={{ width: '100%' }} multiple filterTreeNode showClear leafOnly={false}
                      treeData={departmentTreeData}
                    />
                    <Form.Switch field="memberRule.includeSubDepartments" label="包含子部门" checkedText="是" uncheckedText="否" />
                    <Form.Select
                      field="memberRule.positionIds" label="命中岗位" placeholder="选择岗位（可多选）"
                      extraText="多个岗位满足任一即可；与部门条件同时设置时须同时满足"
                      style={{ width: '100%' }} multiple filter showClear
                      optionList={(positionsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    />
                    <Form.Select
                      field="memberRule.includeUserIds" label="强制包含" placeholder="选择用户（可选）"
                      extraText="规则之外的例外成员"
                      style={{ width: '100%' }} multiple filter showClear
                      optionList={allUsers.map(u => ({ value: u.id, label: `${u.nickname} (${u.username})` }))}
                    />
                    <Form.Select
                      field="memberRule.excludeUserIds" label="强制排除" placeholder="选择用户（可选）"
                      extraText="优先级最高，命中规则也不会加入"
                      style={{ width: '100%' }} multiple filter showClear
                      optionList={allUsers.map(u => ({ value: u.id, label: `${u.nickname} (${u.username})` }))}
                    />
                    <Space vertical align="start" spacing={8} style={{ width: '100%', marginTop: 12 }}>
                      <Button
                        theme="light"
                        loading={rulePreviewMutation.isPending}
                        onClick={() => {
                          const memberRule = ((formState.values as { memberRule?: UserGroupMemberRule }).memberRule ?? {});
                          rulePreviewMutation.mutate(
                            { body: { groupId: groupModal.editing?.id, memberRule } },
                            { onSuccess: setRulePreview },
                          );
                        }}
                      >
                        预览成员变化
                      </Button>
                      {rulePreview && (
                        <div style={{ fontSize: 12, lineHeight: '20px', width: '100%' }}>
                          <Typography.Text type="secondary">
                            目标成员 {rulePreview.total} 人：新加入 {rulePreview.joiningCount} 人，移除 {rulePreview.leavingCount} 人
                          </Typography.Text>
                          {rulePreview.joining.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <Typography.Text type="success">加入：</Typography.Text>
                              <Space wrap spacing={4}>
                                {rulePreview.joining.map((u) => <Tag key={u.id} size="small" color="green">{u.nickname}</Tag>)}
                                {rulePreview.joiningCount > rulePreview.joining.length && <Tag size="small">+{rulePreview.joiningCount - rulePreview.joining.length}</Tag>}
                              </Space>
                            </div>
                          )}
                          {rulePreview.leaving.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <Typography.Text type="danger">移除：</Typography.Text>
                              <Space wrap spacing={4}>
                                {rulePreview.leaving.map((u) => <Tag key={u.id} size="small" color="red">{u.nickname}</Tag>)}
                                {rulePreview.leavingCount > rulePreview.leaving.length && <Tag size="small">+{rulePreview.leavingCount - rulePreview.leaving.length}</Tag>}
                              </Space>
                            </div>
                          )}
                        </div>
                      )}
                    </Space>
                  </div>
                )}
                <Form.TextArea field="description" label="描述" placeholder="请输入描述（可选）" maxCount={256} />
              </>
            );
          }}
        </Form>
        </Spin>
      </SideSheet>

      <SideSheet
        title={
          <Space>
            <Users size={16} />
            <span>成员管理 - {memberGroup?.name}</span>
            {memberGroup?.memberMode === 'dynamic' && <Tag color="teal" size="small">动态</Tag>}
          </Space>
        }
        visible={memberSheetVisible}
        onCancel={() => setMemberSheetVisible(false)}
        width={720}
        footer={
          memberGroup?.memberMode === 'dynamic' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setMemberSheetVisible(false)}>关闭</Button>
              {hasPermission('system:user-groups:assign') && (
                <Button
                  type="primary"
                  icon={<RefreshCw size={14} />}
                  loading={syncMutation.isPending}
                  onClick={() => {
                    if (!memberGroup) return;
                    syncMutation.mutate({ params: { id: memberGroup.id } }, { onSuccess: () => Toast.success('成员已按规则同步') });
                  }}
                >
                  立即同步
                </Button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setMemberSheetVisible(false)}>取消</Button>
              <Button type="primary" disabled={!membersQuery.isSuccess} loading={assignMembersMutation.isPending} onClick={handleSaveMembers}>保存</Button>
            </div>
          )
        }
      >
        {memberGroup?.memberMode === 'dynamic' ? (
          <Space vertical align="start" spacing={12} style={{ width: '100%' }}>
            <Banner
              fullMode={false}
              type="info"
              closeIcon={null}
              description={`成员由规则自动维护，不可手工增删；需要例外时请在编辑规则中使用强制包含/排除名单。${memberGroup.ruleSyncedAt ? `最近同步：${memberGroup.ruleSyncedAt}` : '尚未同步'}`}
              style={{ width: '100%' }}
            />
            <Spin spinning={membersQuery.isFetching} style={{ width: '100%' }}>
              {(membersQuery.data ?? []).length === 0 ? (
                <Empty title="暂无成员" description="当前没有用户命中该组规则" style={{ padding: '32px 0' }} />
              ) : (
                <Space wrap spacing={6}>
                  {(membersQuery.data ?? []).map((m) => (
                    <Tag key={m.id} size="large">{m.nickname}（{m.username}）</Tag>
                  ))}
                </Space>
              )}
            </Spin>
          </Space>
        ) : allUsers.length === 0 ? (
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

      <AppModal
        title={`分配角色 — ${roleGroup?.name ?? ''}`}
        visible={roleModalVisible}
        onCancel={() => { setRoleModalVisible(false); setRoleGroup(null); }}
        onOk={handleSaveRoles}
        okButtonProps={{ disabled: !groupRolesQuery.isSuccess }}
        confirmLoading={assignRolesMutation.isPending}
        width={480}
      >
        <Spin spinning={groupRolesQuery.isFetching || allRolesQuery.isFetching} wrapperClassName="modal-spin-wrapper">
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
            组内成员将自动继承所选角色的菜单与数据权限（与成员直接分配的角色取并集）
          </div>
          <Select
            multiple
            filter
            placeholder="请选择角色"
            style={{ width: '100%' }}
            value={roleIds}
            onChange={(v) => setRoleIds((v as number[]) ?? [])}
            optionList={(allRolesQuery.data ?? []).map((r) => ({ value: r.id, label: `${r.name}（${r.code}）` }))}
          />
        </Spin>
      </AppModal>
    </div>
  );
}
