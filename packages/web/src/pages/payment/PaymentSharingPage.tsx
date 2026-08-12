import { useState } from 'react';
import { formatYuan } from '@/utils/payment';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Select, Switch, Tabs, TabPane, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Plus } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import { createdAtColumn, dateTimeColumn } from '@/utils/table-columns';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import {
  paymentSharingKeys,
  useCreatePaymentSharingOrder,
  useDeletePaymentSharingReceivers,
  useEnabledPaymentSharingReceivers,
  usePaymentSharingOrders,
  usePaymentSharingReceivers,
  useSavePaymentSharingReceiver,
} from '@/hooks/queries/payment-sharing';
import { PAYMENT_SHARING_RECEIVER_TYPE_LABELS, PAYMENT_SHARING_ORDER_STATUS_LABELS } from '@zenith/shared/payment';
import type { PaymentSharingOrder, PaymentSharingOrderStatus, PaymentSharingReceiver, PaymentSharingReceiverType } from '@zenith/shared/payment';
import { useDictItems } from '@/hooks/useDictItems';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

const yuan = formatYuan;
const receiverTypeOptions = Object.entries(PAYMENT_SHARING_RECEIVER_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const ORDER_STATUS_COLOR = { pending: 'grey', processing: 'blue', success: 'green', failed: 'red' } as const satisfies Record<PaymentSharingOrderStatus, string>;

interface ReceiverFormValues { name: string; receiverType: PaymentSharingReceiverType; account: string; ratioPercent?: number; autoShare?: boolean; status?: 'enabled' | 'disabled'; remark?: string; }
interface DispatchFormValues { orderNo: string; receiverId: number; amountYuan?: number; remark?: string; }

export default function PaymentSharingPage() {
  const { items: statusItems } = useDictItems('common_status');
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const canManage = hasPermission('payment:sharing:manage');
  const canDispatch = hasPermission('payment:sharing:dispatch');
  const [activeTab, setActiveTab] = useState<'receivers' | 'orders'>('receivers');

  // ── 接收方 ──
  const { page: rPage, pageSize: rPageSize, setPage: setRPage, buildPagination: buildRPagination } = usePagination();
  const [receiverKeyword, setReceiverKeyword] = useState('');
  const [submittedReceiverKeyword, setSubmittedReceiverKeyword] = useState('');
  // ── 分账单 ──
  const { page: oPage, pageSize: oPageSize, setPage: setOPage, buildPagination: buildOPagination } = usePagination();
  const [orderKeyword, setOrderKeyword] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [submittedOrderParams, setSubmittedOrderParams] = useState({ keyword: '', status: '' });

  const receiverQuery = usePaymentSharingReceivers({
    page: rPage,
    pageSize: rPageSize,
    keyword: submittedReceiverKeyword || undefined,
  });
  const receiverData = receiverQuery.data?.list ?? [];
  const receiverTotal = receiverQuery.data?.total ?? 0;
  const orderQuery = usePaymentSharingOrders({
    page: oPage,
    pageSize: oPageSize,
    keyword: submittedOrderParams.keyword || undefined,
    status: submittedOrderParams.status || undefined,
  });
  const orderData = orderQuery.data?.list ?? [];
  const orderTotal = orderQuery.data?.total ?? 0;
  const saveReceiverMutation = useSavePaymentSharingReceiver();
  const toggleReceiverMutation = useSavePaymentSharingReceiver();
  const deleteReceiverMutation = useDeletePaymentSharingReceivers();
  const createOrderMutation = useCreatePaymentSharingOrder();
  const togglingId = toggleReceiverMutation.isPending ? (toggleReceiverMutation.variables?.id ?? null) : null;

  const receiverModal = useEditModal<PaymentSharingReceiver, ReceiverFormValues, Partial<PaymentSharingReceiver>>({
    entityName: '分账接收方',
    save: saveReceiverMutation,
    defaults: { name: '', receiverType: 'merchant', account: '', autoShare: false, status: 'enabled' },
    toValues: (record) => ({
      name: record.name,
      receiverType: record.receiverType,
      account: record.account,
      ratioPercent: record.ratioBps != null ? record.ratioBps / 100 : undefined,
      autoShare: record.autoShare,
      status: record.status,
      remark: record.remark ?? '',
    }),
    beforeSave: (values) => {
      if (values.autoShare && values.ratioPercent == null) {
        Toast.warning('开启自动分账需先设置默认比例');
        throw new Error('validation');
      }
      return {
        name: values.name,
        receiverType: values.receiverType,
        account: values.account,
        ratioBps: values.ratioPercent != null ? Math.round(values.ratioPercent * 100) : undefined,
        autoShare: values.autoShare ?? false,
        status: values.status,
        remark: values.remark || undefined,
      };
    },
    labelWidth: 104,
  });
  const dispatchSaveMutation = {
    mutateAsync: ({ values }: { id?: number; values: { orderNo: string; receiverId: number; amount?: number; remark?: string } }) => createOrderMutation.mutateAsync(values),
    isPending: createOrderMutation.isPending,
  };
  const dispatchModal = useEditModal<PaymentSharingOrder, DispatchFormValues, { orderNo: string; receiverId: number; amount?: number; remark?: string }>({
    save: dispatchSaveMutation,
    beforeSave: (values) => ({
      orderNo: values.orderNo,
      receiverId: values.receiverId,
      amount: values.amountYuan != null ? Math.round(values.amountYuan * 100) : undefined,
      remark: values.remark || undefined,
    }),
    successMessage: () => '分账已发起',
    labelWidth: 104,
  });
  const dispatchReceiversQuery = useEnabledPaymentSharingReceivers(dispatchModal.visible);
  const dispatchReceivers = dispatchReceiversQuery.data ?? [];

  // ── 接收方处理 ──
  async function handleReceiverToggle(r: PaymentSharingReceiver, checked: boolean) {
    await toggleReceiverMutation.mutateAsync({ id: r.id, values: { status: checked ? 'enabled' : 'disabled' } });
    Toast.success(checked ? '已启用' : '已停用');
  }

  async function handleDeleteReceiver(id: number) {
    await deleteReceiverMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  // ── 分账处理 ──
  function openDispatch() {
    dispatchModal.openCreate();
  }

  const receiverColumns: ColumnProps<PaymentSharingReceiver>[] = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '类型', dataIndex: 'receiverType', width: 90, render: (v: PaymentSharingReceiverType) => PAYMENT_SHARING_RECEIVER_TYPE_LABELS[v] },
    { title: '账号', dataIndex: 'account', width: 200, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} copyable={{ content: v }} style={{ maxWidth: 180 }}>{v}</Typography.Text> },
    { title: '默认比例', dataIndex: 'ratioBps', width: 110, render: (v: number | null) => (v == null ? '-' : `${(v / 100).toFixed(2)}%`) },
    { title: '自动分账', dataIndex: 'autoShare', width: 100, render: (v: boolean) => (v ? <Tag color="green">自动</Tag> : <Tag color="grey">手动</Tag>) },
    createdAtColumn as ColumnProps<PaymentSharingReceiver>,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (_: unknown, r: PaymentSharingReceiver) => <Switch checked={r.status === 'enabled'} loading={togglingId === r.id} disabled={!canManage} size="small" onChange={(c) => void handleReceiverToggle(r, c)} />,
    },
    createOperationColumn<PaymentSharingReceiver>({
      width: 120,
      actions: (r) => [
        ...(canManage ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => receiverModal.openEdit(r),
        }, {
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({
              content: '删除后不可恢复',
              onOk: () => handleDeleteReceiver(r.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  const orderColumns: ColumnProps<PaymentSharingOrder>[] = [
    { title: '分账单号', dataIndex: 'sharingNo', width: 180, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} copyable={{ content: v }} style={{ maxWidth: 160 }}>{v}</Typography.Text> },
    { title: '订单号', dataIndex: 'orderNo', width: 180 },
    { title: '接收方', dataIndex: 'receiverName', width: 140, render: (v: string | null) => v || '-' },
    { title: '分账金额', dataIndex: 'amount', width: 110, render: (v: number) => yuan(v) },
    { title: '渠道分账号', dataIndex: 'channelSharingNo', width: 180, render: (v: string | null) => v || '-' },
    dateTimeColumn('完成时间', 'finishedAt'),
    createdAtColumn as ColumnProps<PaymentSharingOrder>,
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentSharingOrderStatus) => <Tag color={ORDER_STATUS_COLOR[v]}>{PAYMENT_SHARING_ORDER_STATUS_LABELS[v]}</Tag> },
  ];

  const handleReceiverSearch = () => {
    setRPage(1);
    setSubmittedReceiverKeyword(receiverKeyword);
    void queryClient.invalidateQueries({ queryKey: paymentSharingKeys.receiverLists });
  };
  const handleReceiverReset = () => {
    setReceiverKeyword('');
    setRPage(1);
    setSubmittedReceiverKeyword('');
    void queryClient.invalidateQueries({ queryKey: paymentSharingKeys.receiverLists });
  };
  const handleOrderSearch = () => {
    setOPage(1);
    setSubmittedOrderParams({ keyword: orderKeyword, status: orderStatus });
    void queryClient.invalidateQueries({ queryKey: paymentSharingKeys.orderLists });
  };
  const handleOrderReset = () => {
    setOrderKeyword('');
    setOrderStatus('');
    setOPage(1);
    setSubmittedOrderParams({ keyword: '', status: '' });
    void queryClient.invalidateQueries({ queryKey: paymentSharingKeys.orderLists });
  };

  const renderReceiverKeywordSearch = () => (
    <KeywordInput placeholder="名称..." value={receiverKeyword} onChange={setReceiverKeyword} onSearch={handleReceiverSearch} width={200} />
  );
  const renderReceiverSearchButton = () => <SearchButton onClick={handleReceiverSearch} />;
  const renderReceiverResetButton = () => <ResetButton onClick={handleReceiverReset} />;
  const renderReceiverCreateButton = () => canManage ? (
    <CreateButton onClick={receiverModal.openCreate} />
  ) : null;

  const renderOrderKeywordSearch = () => (
    <KeywordInput placeholder="订单号..." value={orderKeyword} onChange={setOrderKeyword} onSearch={handleOrderSearch} width={200} />
  );
  const renderOrderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={orderStatus || undefined}
      onChange={(v) => setOrderStatus((v as string) ?? '')}
      showClear
      style={{ width: 120 }}
      optionList={Object.entries(PAYMENT_SHARING_ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );
  const renderOrderSearchButton = () => <SearchButton onClick={handleOrderSearch} />;
  const renderOrderResetButton = () => <ResetButton onClick={handleOrderReset} />;
  const renderDispatchButton = () => canDispatch ? (
    <Button type="primary" icon={<Plus size={14} />} onClick={openDispatch}>发起分账</Button>
  ) : null;

  return (
    <div className="page-container page-tabs-page">
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'receivers' | 'orders')} type="line" lazyRender keepDOM={false}>
        <TabPane tab="分账接收方" itemKey="receivers">
          <SearchToolbar
            primary={(
              <>
                {renderReceiverKeywordSearch()}
                {renderReceiverSearchButton()}
                {renderReceiverResetButton()}
                {renderReceiverCreateButton()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderReceiverKeywordSearch()}
                {renderReceiverSearchButton()}
                {renderReceiverCreateButton()}
              </>
            )}
          />
          <ConfigurableTable
            bordered columns={receiverColumns} dataSource={receiverData} loading={receiverQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void receiverQuery.refetch()} refreshLoading={receiverQuery.isFetching} pagination={buildRPagination(receiverTotal)}
          />
        </TabPane>
        <TabPane tab="分账单" itemKey="orders">
          <SearchToolbar
            primary={(
              <>
                {renderOrderKeywordSearch()}
                {renderOrderStatusFilter()}
                {renderOrderSearchButton()}
                {renderOrderResetButton()}
                {renderDispatchButton()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderOrderKeywordSearch()}
                {renderOrderSearchButton()}
                {renderDispatchButton()}
              </>
            )}
            mobileFilters={renderOrderStatusFilter()}
            filterTitle="分账单筛选"
            onFilterApply={handleOrderSearch}
            onFilterReset={handleOrderReset}
          />
          <ConfigurableTable
            bordered columns={orderColumns} dataSource={orderData} loading={orderQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void orderQuery.refetch()} refreshLoading={orderQuery.isFetching} pagination={buildOPagination(orderTotal)}
          />
        </TabPane>
      </Tabs>

      <AppModal {...receiverModal.modalProps} width={520}>
        <Form {...receiverModal.formProps}>
          <Form.Input field="name" label="名称" placeholder="如：合作商户 A" rules={[{ required: true, message: '名称不能为空' }]} />
          <Form.Select field="receiverType" label="类型" style={{ width: '100%' }} optionList={receiverTypeOptions} rules={[{ required: true, message: '请选择类型' }]} />
          <Form.Input field="account" label="账号" placeholder="商户号 / 个人 openid" rules={[{ required: true, message: '账号不能为空' }]} />
          <Form.InputNumber field="ratioPercent" label="默认比例(%)" min={0} max={100} step={0.01} precision={2} style={{ width: '100%' }} placeholder="可选，发起分账时可覆盖" />
          <Form.Switch field="autoShare" label="自动分账" extraText="开启后支付成功将按默认比例自动向该接收方发起分账" />
          <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))} />
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>

      <AppModal {...dispatchModal.modalProps} title="发起分账" width={520}>
        <Form {...dispatchModal.formProps}>
          <Form.Input field="orderNo" label="订单号" placeholder="已支付成功的支付订单号" rules={[{ required: true, message: '订单号不能为空' }]} />
          <Form.Select field="receiverId" label="接收方" style={{ width: '100%' }} rules={[{ required: true, message: '请选择接收方' }]}
            optionList={dispatchReceivers.map((r) => ({ value: r.id, label: `${r.name}（${PAYMENT_SHARING_RECEIVER_TYPE_LABELS[r.receiverType]}）` }))} />
          <Form.InputNumber field="amountYuan" label="分账金额(元)" min={0.01} step={0.01} precision={2} style={{ width: '100%' }} placeholder="留空=按接收方默认比例计算" />
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>
    </div>
  );
}
