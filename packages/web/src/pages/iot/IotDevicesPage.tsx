import { useState } from 'react';
import { Badge, Col, Form, Row, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useDictItems } from '@/hooks/useDictItems';
import { confirmDelete } from '@/utils/confirm';
import type { IotDevice } from '@zenith/shared/iot';
import { useAllIotProducts } from '@/hooks/queries/iot-products';
import {
  iotDeviceKeys, useDeleteIotDevices, useIotDeviceList, useSaveIotDevice,
} from '@/hooks/queries/iot-devices';
import IotDeviceDetailDrawer from './IotDeviceDetailDrawer';

const { Text } = Typography;

interface SearchParams {
  keyword: string;
  status: string;
  productId: number | null;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '', productId: null };

function renderMetricValue(v: number | string | boolean): string {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

export default function IotDevicesPage() {
  const { hasPermission } = usePermission();
  const { items: statusItems } = useDictItems('common_status');
  const [detailDevice, setDetailDevice] = useState<IotDevice | null>(null);

  const productsQuery = useAllIotProducts();
  const products = productsQuery.data ?? [];

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: iotDeviceKeys.lists });

  const listQuery = useIotDeviceList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    productId: submittedParams.productId ?? undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const modal = useEditModal<IotDevice, Record<string, unknown>, Partial<IotDevice>>({
    entityName: '设备',
    save: useSaveIotDevice(),
    toValues: (r) => ({
      productId: r.productId,
      name: r.name,
      firmwareVersion: r.firmwareVersion ?? '',
      status: r.status,
      remark: r.remark ?? '',
    }),
    defaults: { status: 'enabled' },
    beforeSave: (values, { isEdit }) => ({
      productId: values.productId as number,
      name: values.name as string,
      // SN 仅创建时可指定，编辑不可变更
      ...(isEdit ? {} : { sn: (values.sn as string)?.trim() || undefined }),
      firmwareVersion: (values.firmwareVersion as string) || null,
      status: values.status as IotDevice['status'],
      remark: (values.remark as string) || null,
    }),
    labelWidth: 100,
  });

  const deleteMutation = useDeleteIotDevices();

  async function handleDelete(ids: number[]) {
    await deleteMutation.mutateAsync(ids);
    Toast.success('删除成功');
  }

  const columns: ColumnProps<IotDevice>[] = [
    {
      title: 'SN', dataIndex: 'sn', width: 180,
      render: (v: string) => <Text copyable size="small" style={{ whiteSpace: 'nowrap' }}>{v}</Text>,
    },
    { title: '设备名称', dataIndex: 'name', width: 150 },
    {
      title: '所属产品', dataIndex: 'productName', width: 140,
      render: (v: string | null) => v ?? EMPTY_PLACEHOLDER,
    },
    {
      title: '在线', dataIndex: 'online', width: 80, align: 'center',
      render: (v: boolean) => (
        <Badge dot type={v ? 'success' : 'tertiary'}>
          <Text size="small" type={v ? 'success' : 'tertiary'}>{v ? '在线' : '离线'}</Text>
        </Badge>
      ),
    },
    {
      title: '最近指标', width: 220,
      render: (_: unknown, r: IotDevice) => {
        const entries = Object.entries(r.latestMetrics ?? {});
        if (entries.length === 0) return EMPTY_PLACEHOLDER;
        const shown = entries.slice(0, 3);
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {shown.map(([k, v]) => (
              <Tag key={k} size="small" color="cyan">{k}: {renderMetricValue(v)}</Tag>
            ))}
            {entries.length > 3 && <Tag size="small">+{entries.length - 3}</Tag>}
          </div>
        );
      },
    },
    {
      title: '固件', dataIndex: 'firmwareVersion', width: 90,
      render: (v: string | null) => v ?? EMPTY_PLACEHOLDER,
    },
    {
      title: '最后在线', dataIndex: 'lastSeenAt', width: 160,
      render: (v: string | null) => v ?? EMPTY_PLACEHOLDER,
    },
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: IotDevice['status']) => (
        <Tag color={v === 'enabled' ? 'green' : 'red'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>
      ),
    },
    createOperationColumn<IotDevice>({
      width: 170,
      desktopInlineKeys: ['detail'],
      actions: (record) => [
        {
          key: 'detail', label: '详情', onClick: () => setDetailDevice(record),
        },
        ...(hasPermission('iot:device:update') ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('iot:device:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: `确定要删除设备「${record.name}」吗？`,
              content: '遥测数据与指令记录将一并清除，不可恢复',
              onOk: () => handleDelete([record.id]),
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索 SN / 设备名..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderProductFilter = () => (
    <StatusSelect
      placeholder="全部产品"
      items={products.map((p) => ({ value: String(p.id), label: p.name }))}
      value={draftParams.productId === null ? '' : String(draftParams.productId)}
      onChange={(v) => setDraftParams((p) => ({ ...p, productId: v ? Number(v) : null }))}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderCreateButton = () => hasPermission('iot:device:create')
    ? <CreateButton onClick={modal.openCreate}>注册设备</CreateButton> : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          {renderProductFilter()}
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
        mobileFilters={<>
          {renderProductFilter()}
          {renderStatusFilter()}
        </>}
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
        empty="暂无设备，点击「注册设备」接入第一台设备"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      {/* 注册 / 编辑设备 */}
      <AppModal {...modal.modalProps} width={560}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            <Form.Select
              field="productId" label="所属产品" placeholder="选择产品" style={{ width: '100%' }}
              optionList={products.map((p) => ({ value: p.id, label: p.name }))}
              rules={[{ required: true, message: '请选择所属产品' }]}
            />
            <Form.Input field="name" label="设备名称" placeholder="如：机房 A-01 温湿度"
              rules={[{ required: true, message: '设备名称不能为空' }]} />
            {!modal.editing && (
              <Form.Input
                field="sn" label="设备 SN" placeholder="留空自动生成"
                extraText="仅字母、数字、连字符；一经接入不可变更"
                rules={[{ validator: (_r, v: string) => !v || /^[0-9A-Za-z-]{4,64}$/.test(v), message: 'SN 为 4-64 位字母、数字或连字符' }]}
              />
            )}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input field="firmwareVersion" label="固件版本" placeholder="如 1.0.0（选填）" />
              </Col>
              <Col span={12}>
                <Form.RadioGroup field="status" label="状态">
                  {statusItems.map((o) => (
                    <Form.Radio key={o.value} value={o.value}>{o.label}</Form.Radio>
                  ))}
                </Form.RadioGroup>
              </Col>
            </Row>
            <Form.TextArea field="remark" label="备注" rows={2} placeholder="安装位置等说明（选填）" maxCount={256} />
          </Form>
        </Spin>
      </AppModal>

      <IotDeviceDetailDrawer device={detailDevice} onClose={() => setDetailDevice(null)} />
    </div>
  );
}
