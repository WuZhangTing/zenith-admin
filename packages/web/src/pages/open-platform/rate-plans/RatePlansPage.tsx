import { Tag, Form, Toast, Typography, Select, Row, Col, Space } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { RatePlan } from '@zenith/shared/open-platform';
import { createdAtColumn } from '@/utils/table-columns';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { openPlatformKeys, useDeleteRatePlan, useRatePlanList, useSaveRatePlan } from '@/hooks/queries/open-platform';
import { useDictItems } from '@/hooks/useDictItems';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

const { Text } = Typography;

const fmtQuota = (n: number) => (n > 0 ? n.toLocaleString() : '不限');

type FormValues = {
  code: string;
  name: string;
  description?: string;
  qpsLimit: number;
  dailyQuota: number;
  monthlyQuota: number;
  isDefault: boolean;
  status: 'enabled' | 'disabled';
};

export default function RatePlansPage() {
  const { items: statusItems } = useDictItems('common_status');
  const STATUS_OPTIONS = statusItems.map((i) => ({ value: i.value, label: i.label }));
  const { hasPermission } = usePermission();
  const canManage = hasPermission('open:rate-plan:manage');

  interface SearchParams { keyword: string; status?: 'enabled' | 'disabled' }
  const defaultSearchParams: SearchParams = { keyword: '', status: undefined };
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: openPlatformKeys.ratePlans.lists });

    const listQuery = useRatePlanList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status,
  });
  const data = listQuery.data ?? null;
  const deleteMutation = useDeleteRatePlan();

  const modal = useEditModal<RatePlan, FormValues>({
    entityName: '限流套餐',
    save: useSaveRatePlan(),
    defaults: { qpsLimit: 10, dailyQuota: 0, monthlyQuota: 0, isDefault: false, status: 'enabled' },
    toValues: (r) => ({
      code: r.code,
      name: r.name,
      description: r.description ?? '',
      qpsLimit: r.qpsLimit,
      dailyQuota: r.dailyQuota,
      monthlyQuota: r.monthlyQuota,
      isDefault: r.isDefault,
      status: r.status,
    }),
  });

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync(id);
    Toast.success('删除成功');
  }

  const columns: ColumnProps<RatePlan>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: string, r: RatePlan) => (
        <Space spacing={6}>
          {v}
          {r.isDefault && <Tag color="blue" size="small">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '编码',
      dataIndex: 'code',
      width: 160,
      render: (v: string) => <Text copyable={{ content: v }}>{v}</Text>,
    },
    { title: 'QPS', dataIndex: 'qpsLimit', width: 100, align: 'right', render: (v: number) => (v > 0 ? `${v}/s` : '不限') },
    { title: '每日配额', dataIndex: 'dailyQuota', width: 120, align: 'right', render: fmtQuota },
    { title: '每月配额', dataIndex: 'monthlyQuota', width: 120, align: 'right', render: fmtQuota },
    { title: '描述', dataIndex: 'description', width: 220, render: (v: string | null) => v ? <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 210 }}>{v}</Text> : <Text type="tertiary">—</Text> },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right' as const,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'grey'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>,
    },
    createOperationColumn<RatePlan>({
      width: 140,
      actions: (record) => [
        { key: 'edit', label: '编辑', hidden: !canManage, onClick: () => modal.openEdit(record) },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canManage,
          onClick: () => {
            confirmDelete({
              title: '确定要删除此套餐吗？',
              content: '已被应用绑定的套餐无法删除',
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
            <KeywordInput placeholder="搜索套餐编码 / 名称" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} />
            <Select
              placeholder="状态"
              value={draftParams.status}
              onChange={(v) => setDraftParams({ ...draftParams, status: v as 'enabled' | 'disabled' })}
              optionList={STATUS_OPTIONS}
              showClear
              style={{ width: 110 }}
            />
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
          </>
        )}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索套餐" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} width={200} />
            <SearchButton onClick={handleSearch} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
          </>
        )}
        mobileActions={<ResetButton onClick={handleReset} />}
        actionTitle="套餐操作"
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
        pagination={buildPagination(data?.total ?? 0)}
      />

      <AppModal {...modal.modalProps} width={660}>
        <Form key={modal.formKey} {...modal.formProps}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Input
                field="code"
                label="套餐编码"
                placeholder="如 free / pro"
                disabled={modal.isEdit}
                extraText={modal.isEdit ? '编码不可修改' : '小写字母开头'}
                rules={[{ required: true, message: '套餐编码不能为空' }]}
              />
            </Col>
            <Col span={12}>
              <Form.Input field="name" label="套餐名称" placeholder="如 免费版" rules={[{ required: true, message: '名称不能为空' }]} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.InputNumber field="qpsLimit" label="QPS" min={0} style={{ width: '100%' }} extraText="0=不限" rules={[{ required: true, message: '必填' }]} />
            </Col>
            <Col span={8}>
              <Form.InputNumber field="dailyQuota" label="每日配额" min={0} style={{ width: '100%' }} extraText="0=不限" rules={[{ required: true, message: '必填' }]} />
            </Col>
            <Col span={8}>
              <Form.InputNumber field="monthlyQuota" label="每月配额" min={0} style={{ width: '100%' }} extraText="0=不限" rules={[{ required: true, message: '必填' }]} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Switch field="isDefault" label="默认套餐" extraText="应用未绑定套餐时回退使用" />
            </Col>
            <Col span={12}>
              <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={STATUS_OPTIONS} rules={[{ required: true, message: '请选择状态' }]} />
            </Col>
          </Row>
          <Form.TextArea field="description" label="描述" placeholder="套餐说明（可选）" rows={2} />
        </Form>
      </AppModal>
    </div>
  );
}
