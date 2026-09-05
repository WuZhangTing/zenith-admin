import { useState } from 'react';
import { Button, Tag, Form, Toast, Typography, Row, Col } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Trash2 } from 'lucide-react';
import { USER_STATUSES, enumValueOf } from '@zenith/shared/core';
import { API_SCOPE_GROUPS, API_SCOPE_GROUP_LABELS } from '@zenith/shared/open-platform';
import type { ApiScope, CreateApiScopeInput } from '@zenith/shared/open-platform';
import { copyableNoColumn, createdAtColumn } from '@/utils/table-columns';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import {
  apiScopeKeys,
  useApiScopeList,
  useDeleteApiScopes,
  useSaveApiScope,
} from '@/hooks/queries/open-platform';
import { useDictItems } from '@/hooks/useDictItems';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { FilterSelect, KeywordInput, StatusSelect } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

const { Text } = Typography;

const GROUP_OPTIONS = API_SCOPE_GROUPS.map((g) => ({ value: g, label: API_SCOPE_GROUP_LABELS[g] ?? g }));

export default function ApiScopesPage() {
  const { items: statusItems } = useDictItems('common_status');
  const STATUS_OPTIONS = statusItems.map((i) => ({ value: i.value, label: i.label }));
  const { hasPermission } = usePermission();
  const canManage = hasPermission('open:scope:manage');

  interface SearchParams { keyword: string; scopeGroup?: string; status?: string }
  const defaultSearchParams: SearchParams = { keyword: '', scopeGroup: undefined, status: undefined };
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: apiScopeKeys.lists });

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const listQuery = useApiScopeList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    scopeGroup: submittedParams.scopeGroup,
    status: enumValueOf(USER_STATUSES, submittedParams.status),
  });
  const data = listQuery.data ?? null;
  const deleteMutation = useDeleteApiScopes();

  const modal = useEditModal<ApiScope, Partial<CreateApiScopeInput>>({
    save: useSaveApiScope(),
    defaults: { scopeGroup: 'general', status: 'enabled' },
    // 记录里的 null 描述在表单中视为未填
    toValues: (r) => ({
      code: r.code,
      name: r.name,
      scopeGroup: r.scopeGroup,
      description: r.description ?? undefined,
      status: r.status,
    }),
    labelWidth: 110,
  });

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  function handleBatchDelete() {
    confirmDelete({
      title: `确定删除选中的 ${selectedRowKeys.length} 个 Scope？`,
      content: '删除后不可恢复',
      onOk: async () => {
        await deleteMutation.mutateAsync(selectedRowKeys);
        Toast.success('批量删除成功');
        setSelectedRowKeys([]);
      },
    });
  }

  const columns: ColumnProps<ApiScope>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    copyableNoColumn('Scope 编码', 'code', { width: 200 }),
    { title: '名称', dataIndex: 'name', width: 160, render: (v: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 150 }}>{v}</Text> },
    {
      title: '分组',
      dataIndex: 'scopeGroup',
      width: 100,
      render: (v: string) => <Tag size="small" color="blue">{API_SCOPE_GROUP_LABELS[v] ?? v}</Tag>,
    },
    { title: '描述', dataIndex: 'description', minWidth: 240, render: (v: string | null) => v ? <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 230 }}>{v}</Text> : <Text type="tertiary">—</Text> },
    {
      title: '被引用',
      align: 'right',
      dataIndex: 'usedByAppCount',
      width: 100,
      render: (v: number) => (
        v > 0
          ? <Tag size="small" color="orange">{v} 个应用</Tag>
          : <Text type="tertiary">未被引用</Text>
      ),
    },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right' as const,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'grey'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>,
    },
    createOperationColumn<ApiScope>({
      width: 150,
      actions: (record) => [
        { key: 'edit', label: '编辑', hidden: !canManage, onClick: () => modal.openEdit(record) },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canManage,
          onClick: () => {
            confirmDelete({
              title: '确定要删除此 Scope 吗？',
              content: '删除后不可恢复',
              onOk: () => handleDelete(record.id),
            });
          },
        },
      ],
    }),
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <KeywordInput placeholder="搜索编码 / 名称" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} width={200} />
            <FilterSelect
              placeholder="全部分组"
              items={GROUP_OPTIONS}
              value={draftParams.scopeGroup}
              onChange={(v) => setDraftParams({ ...draftParams, scopeGroup: v as string })}
            />
            <StatusSelect
              items={STATUS_OPTIONS}
              value={draftParams.status}
              onChange={(v) => setDraftParams({ ...draftParams, status: v as string })}
            />
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
            {canManage && selectedRowKeys.length > 0 && (
              <Button type="danger" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>批量删除（{selectedRowKeys.length}）</Button>
            )}
          </>
        )}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索编码 / 名称" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} width={200} />
            <SearchButton onClick={handleSearch} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
          </>
        )}
        mobileActions={<ResetButton onClick={handleReset} />}
        actionTitle="Scope 操作"
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data?.list ?? []}
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无数据"
        rowSelection={canManage ? { selectedRowKeys, onChange: (keys) => setSelectedRowKeys((keys ?? []) as number[]) } : undefined}
        pagination={buildPagination(data?.total ?? 0)}
      />

      <AppModal
        {...modal.modalProps}
        title={modal.isEdit ? '编辑 API Scope' : '新增 API Scope'}
        width={520}
      >
        <Form key={modal.formKey} {...modal.formProps}>
          <Form.Input
            field="code"
            label="Scope 编码"
            placeholder="如 user:read"
            disabled={modal.isEdit}
            extraText={modal.isEdit ? '编码创建后不可修改' : '小写字母开头，可含 : . _ -'}
            rules={[{ required: true, message: 'Scope 编码不能为空' }]}
          />
          <Form.Input field="name" label="名称" placeholder="如 读取用户信息" rules={[{ required: true, message: '名称不能为空' }]} />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Select field="scopeGroup" label="分组" style={{ width: '100%' }} optionList={GROUP_OPTIONS} filter allowCreate rules={[{ required: true, message: '请选择分组' }]} />
            </Col>
            <Col span={12}>
              <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={STATUS_OPTIONS} rules={[{ required: true, message: '请选择状态' }]} />
            </Col>
          </Row>
          <Form.TextArea field="description" label="描述" placeholder="该 scope 授予的权限说明（可选）" rows={2} />
        </Form>
      </AppModal>
    </div>
  );
}
