import { Form, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { createdAtColumn, renderEllipsis, EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useDictItems } from '@/hooks/useDictItems';
import { confirmDelete } from '@/utils/confirm';
import type { IotProduct } from '@zenith/shared/iot';
import {
  iotProductKeys, useDeleteIotProducts, useIotProductList, useSaveIotProduct,
} from '@/hooks/queries/iot-products';

const { Text } = Typography;

interface SearchParams {
  keyword: string;
  status: string;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '' };

export default function IotProductsPage() {
  const { hasPermission } = usePermission();
  const { items: statusItems } = useDictItems('common_status');

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: iotProductKeys.lists });

  const listQuery = useIotProductList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const modal = useEditModal<IotProduct, Record<string, unknown>, Partial<IotProduct>>({
    entityName: '产品',
    save: useSaveIotProduct(),
    toValues: (r) => ({
      name: r.name,
      keyMetrics: r.keyMetrics,
      status: r.status,
      description: r.description ?? '',
    }),
    defaults: { status: 'enabled' },
    beforeSave: (values) => ({
      name: values.name as string,
      keyMetrics: (values.keyMetrics as string[] | undefined) ?? [],
      status: values.status as IotProduct['status'],
      description: (values.description as string) || null,
    }),
    labelWidth: 100,
  });

  const deleteMutation = useDeleteIotProducts();

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  const columns: ColumnProps<IotProduct>[] = [
    { title: '产品名称', dataIndex: 'name', width: 180 },
    {
      title: '关键指标', width: 260,
      render: (_: unknown, r: IotProduct) => r.keyMetrics.length > 0
        ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {r.keyMetrics.map((m) => <Tag key={m} size="small" color="cyan">{m}</Tag>)}
            </div>
          )
        : EMPTY_PLACEHOLDER,
    },
    {
      title: '描述', dataIndex: 'description', width: 260,
      render: (v: string | null) => v ? renderEllipsis(v) : EMPTY_PLACEHOLDER,
    },
    {
      title: '设备数', dataIndex: 'deviceCount', width: 90, align: 'right',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: IotProduct['status']) => (
        <Tag color={v === 'enabled' ? 'green' : 'red'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>
      ),
    },
    createOperationColumn<IotProduct>({
      width: 140,
      actions: (record) => [
        ...(hasPermission('iot:product:update') ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('iot:product:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          disabled: (record.deviceCount ?? 0) > 0,
          disabledReason: (record.deviceCount ?? 0) > 0 ? '产品下存在设备' : undefined,
          onClick: () => {
            confirmDelete({
              title: `确定要删除产品「${record.name}」吗？`,
              content: '删除后不可恢复',
              onOk: () => handleDelete(record.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索产品名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderCreateButton = () => hasPermission('iot:product:create')
    ? <CreateButton onClick={modal.openCreate} /> : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          {renderStatusFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderCreateButton()}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          {renderCreateButton()}
        </>}
        mobileFilters={renderStatusFilter()}
        filterTitle="筛选条件"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无 IoT 产品"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={560}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            <Form.Input field="name" label="产品名称" placeholder="如：温湿度传感器"
              rules={[{ required: true, message: '产品名称不能为空' }]} />
            <Form.TagInput
              field="keyMetrics" label="关键指标"
              placeholder="输入指标名后回车，如 temperature"
              extraText="产品下设备遥测的重点字段，设备列表与图表默认展示这些指标"
              max={20}
            />
            <Form.RadioGroup field="status" label="状态">
              {statusItems.map((o) => (
                <Form.Radio key={o.value} value={o.value}>{o.label}</Form.Radio>
              ))}
            </Form.RadioGroup>
            <Form.TextArea field="description" label="描述" rows={3} placeholder="产品用途说明（选填）" maxCount={2000} />
          </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
