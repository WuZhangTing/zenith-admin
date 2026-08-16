import { formatYuan, PAYMENT_CHANNEL_TAG_COLOR } from '@/utils/payment';
import { Button, Form, Modal, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Plus } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import { formatDateForApi } from '@/utils/date';
import { copyableNoColumn, createdAtColumn, dateTimeColumn } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useEditModal } from '@/hooks/useEditModal';
import {
  paymentSettlementKeys,
  useGeneratePaymentSettlement,
  usePaymentSettlementList,
  useUpdatePaymentSettlementStatus,
} from '@/hooks/queries/payment-settlements';
import { PAYMENT_CHANNEL_LABELS, PAYMENT_SETTLEMENT_STATUS_LABELS } from '@zenith/shared/payment';
import type { PaymentChannel, PaymentSettlementBatch, PaymentSettlementStatus } from '@zenith/shared/payment';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';

const yuan = formatYuan;
const channelOptions = Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_COLOR = { pending: 'grey', settling: 'blue', settled: 'green', failed: 'red' } as const satisfies Record<PaymentSettlementStatus, string>;

interface SearchParams { channel: string; status: string; }
const defaultSearch: SearchParams = { channel: '', status: '' };

interface GenerateFormValues { channel: PaymentChannel; period: [Date, Date]; remark?: string; }

export default function PaymentSettlementsPage() {
  const { hasPermission } = usePermission();
  const canSettle = hasPermission('payment:settlement:settle');
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentSettlementKeys.lists });

  const listQuery = usePaymentSettlementList({
    page,
    pageSize,
    channel: submittedParams.channel || undefined,
    status: submittedParams.status || undefined,
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const generateMutation = useGeneratePaymentSettlement();
  const transitionMutation = useUpdatePaymentSettlementStatus();
  const transitioningId = transitionMutation.isPending ? (transitionMutation.variables?.id ?? null) : null;

  const generateSaveMutation = {
    mutateAsync: ({ values }: { id?: number; values: { channel: string; periodStart: string; periodEnd: string; remark?: string } }) => generateMutation.mutateAsync(values),
    isPending: generateMutation.isPending,
  };
  const generateModal = useEditModal<PaymentSettlementBatch, GenerateFormValues, { channel: string; periodStart: string; periodEnd: string; remark?: string }>({
    save: generateSaveMutation,
    defaults: { channel: 'wechat' },
    beforeSave: (values) => ({
      channel: values.channel,
      periodStart: formatDateForApi(values.period[0]),
      periodEnd: formatDateForApi(values.period[1]),
      remark: values.remark || undefined,
    }),
    successMessage: () => '生成成功',
  });

  async function handleTransition(record: PaymentSettlementBatch, status: PaymentSettlementStatus) {
    await transitionMutation.mutateAsync({ id: record.id, status });
    Toast.success('操作成功');
  }

  const columns: ColumnProps<PaymentSettlementBatch>[] = [
    copyableNoColumn('批次号', 'batchNo'),
    { title: '渠道', dataIndex: 'channel', width: 100, render: (v: PaymentChannel) => <Tag color={PAYMENT_CHANNEL_TAG_COLOR[v]}>{PAYMENT_CHANNEL_LABELS[v]}</Tag> },
    { title: '账期', dataIndex: 'periodStart', width: 240, render: (_: unknown, r: PaymentSettlementBatch) => <span style={{ whiteSpace: 'nowrap' }}>{r.periodStart} ~ {r.periodEnd}</span> },
    { title: '订单数', dataIndex: 'orderCount', width: 80 },
    { title: '收款', dataIndex: 'grossAmount', width: 110, render: (v: number) => yuan(v) },
    { title: '手续费', dataIndex: 'feeAmount', width: 100, render: (v: number) => yuan(v) },
    { title: '退款', dataIndex: 'refundAmount', width: 100, render: (v: number) => yuan(v) },
    { title: '净额', dataIndex: 'netAmount', width: 120, render: (v: number) => <Typography.Text strong type={v < 0 ? 'danger' : 'success'}>{yuan(v)}</Typography.Text> },
    dateTimeColumn('到账时间', 'settledAt'),
    createdAtColumn as ColumnProps<PaymentSettlementBatch>,
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentSettlementStatus) => <Tag color={STATUS_COLOR[v]}>{PAYMENT_SETTLEMENT_STATUS_LABELS[v]}</Tag> },
    createOperationColumn<PaymentSettlementBatch>({
      width: 180,
      emptyContent: <Typography.Text type="tertiary">—</Typography.Text>,
      actions: (r) => {
        if (!canSettle || r.status === 'settled' || r.status === 'failed') return [];
        const busy = transitioningId === r.id;
        return [
          ...(r.status === 'pending' ? [{
            key: 'start',
            label: '开始结算',
            loading: busy,
            onClick: () => void handleTransition(r, 'settling'),
          }] : []),
          ...(r.status === 'settling' ? [{
            key: 'settled',
            label: '标记到账',
            loading: busy,
            onClick: () => {
              Modal.confirm({
                title: '确认该批次已到账？',
                onOk: () => handleTransition(r, 'settled'),
              });
            },
          }] : []),
          {
            key: 'failed',
            label: '标记失败',
            danger: true,
            loading: busy,
            onClick: () => {
              Modal.confirm({
                title: '确认标记为结算失败？',
                onOk: () => handleTransition(r, 'failed'),
              });
            },
          },
        ];
      },
    }),
  ];

  const renderChannelFilter = () => (
    <Select
      placeholder="全部渠道"
      value={draftParams.channel || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, channel: (v as string) ?? '' }))}
      showClear
      style={{ width: 130 }}
      optionList={channelOptions}
    />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={Object.entries(PAYMENT_SETTLEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderGenerateButton = () => hasPermission('payment:settlement:generate') ? (
    <Button type="primary" icon={<Plus size={14} />} onClick={generateModal.openCreate}>生成结算</Button>
  ) : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderChannelFilter()}
            {renderStatusFilter()}
            {renderSearchButton()}
            {renderResetButton()}
            {renderGenerateButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderChannelFilter()}
            {renderSearchButton()}
            {renderGenerateButton()}
          </>
        )}
        mobileFilters={(
          <>
            {renderStatusFilter()}
          </>
        )}
        filterTitle="结算批次筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered columns={columns} dataSource={data} loading={listQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
        onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} pagination={buildPagination(total)}
      />

      <AppModal {...generateModal.modalProps} title="生成结算批次" width={520}>
        <Form {...generateModal.formProps}>
          <Form.Select field="channel" label="渠道" style={{ width: '100%' }} optionList={channelOptions} rules={[{ required: true, message: '请选择渠道' }]} />
          <Form.DatePicker
            field="period"
            label="账期"
            type="dateRange"
            style={{ width: '100%' }}
            rules={[
              { required: true, message: '请选择账期' },
              {
                validator: (_rule: unknown, value: unknown) => {
                  if (!Array.isArray(value) || value.length !== 2) return false;
                  const [start, end] = value as [Date, Date];
                  return start <= end;
                },
                message: '账期开始不能晚于结束',
              },
            ]}
          />
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
          <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginLeft: 90 }}>将聚合该渠道账期内成功订单，净额 = 收款 - 手续费 - 退款</Typography.Text>
        </Form>
      </AppModal>
    </div>
  );
}
