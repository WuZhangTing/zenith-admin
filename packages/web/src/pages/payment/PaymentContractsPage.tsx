import { useState, useRef } from 'react';
import { formatYuan } from '@/utils/payment';
import { useQueryClient } from '@tanstack/react-query';
import { Form, Input, Modal, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Tabs, TabPane } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form/interface';
import { Search } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ExportButton from '@/components/ExportButton';
import { formatDateTime } from '@/utils/date';
import { createdAtColumn } from '@/utils/table-columns';
import { useListSearch } from '@/hooks/useListSearch';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import {
  paymentContractKeys,
  useAllDeductPlans,
  useCreateDeductPlan,
  useCreatePaymentContract,
  useDeductPaymentContract,
  useDeductPlanList,
  useDeleteDeductPlan,
  usePausePaymentContract,
  usePaymentContractList,
  useResumePaymentContract,
  useTerminatePaymentContract,
  useUpdateDeductPlan,
} from '@/hooks/queries/payment-contracts';
import { PAYMENT_CHANNEL_LABELS, PAYMENT_CONTRACT_STATUS_LABELS, PAYMENT_DEDUCT_PERIOD_LABELS, PAYMENT_DEDUCT_PERIOD_OPTIONS } from '@zenith/shared/payment';
import type { PaymentChannel, PaymentContract, PaymentContractStatus, PaymentDeductPeriod, PaymentDeductPlan } from '@zenith/shared/payment';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { confirmDelete } from '@/utils/confirm';

const yuan = formatYuan;
const CONTRACT_STATUS_COLOR = { pending: 'grey', signed: 'green', paused: 'orange', terminated: 'red' } as const satisfies Record<PaymentContractStatus, string>;
const contractStatusOptions = Object.entries(PAYMENT_CONTRACT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const channelOptions = Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => ({ value, label }));
const DEDUCT_METHOD_OPTIONS = [
  { value: 'wechat_papay', label: '微信委托代扣' },
  { value: 'alipay_cycle', label: '支付宝周期扣款' },
];

interface PlanFormValues { name: string; period: PaymentDeductPeriod; customDays?: number; amountYuan: number; maxRetries: number; status?: 'enabled' | 'disabled'; remark?: string; }
interface ContractFormValues { planId: number; payMethod: string; signerAccount: string; signerName?: string; remark?: string; firstDeductNow?: boolean; }

function describePlanPeriod(p: Pick<PaymentDeductPlan, 'period' | 'customDays'>): string {
  return p.period === 'custom' ? `每 ${p.customDays ?? '-'} 天` : PAYMENT_DEDUCT_PERIOD_LABELS[p.period];
}

interface SearchParams { keyword: string; status: string; channel: string }
const defaultSearchParams: SearchParams = { keyword: '', status: '', channel: '' };

export default function PaymentContractsPage() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const canManage = hasPermission('payment:contract:manage');
  const canPlan = hasPermission('payment:contract:plan');
  const planFormApi = useRef<FormApi | null>(null);
  const contractFormApi = useRef<FormApi | null>(null);
  const [activeTab, setActiveTab] = useState<'contracts' | 'plans'>('contracts');

  // ── 签约协议 ──
  const {
    page: cPage, pageSize: cPageSize, buildPagination: buildCPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch({ defaults: defaultSearchParams, listKey: paymentContractKeys.lists });
  const [contractModal, setContractModal] = useState(false);

  // ── 扣款计划 ──
  const { page: pPage, pageSize: pPageSize, setPage: setPPage, buildPagination: buildPPagination } = usePagination();
  const [planKeyword, setPlanKeyword] = useState('');
  const [submittedPlanKeyword, setSubmittedPlanKeyword] = useState('');
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentDeductPlan | null>(null);
  const [planPeriod, setPlanPeriod] = useState<PaymentDeductPeriod>('monthly');

  const contractQuery = usePaymentContractList({
    page: cPage,
    pageSize: cPageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    channel: submittedParams.channel || undefined,
  });
  const contracts = contractQuery.data?.list ?? [];
  const contractTotal = contractQuery.data?.total ?? 0;
  const planQuery = useDeductPlanList({ page: pPage, pageSize: pPageSize, keyword: submittedPlanKeyword || undefined });
  const plans = planQuery.data?.list ?? [];
  const planTotal = planQuery.data?.total ?? 0;
  const allPlansQuery = useAllDeductPlans();
  const allPlans = allPlansQuery.data ?? [];

  const createContractMutation = useCreatePaymentContract();
  const terminateMutation = useTerminatePaymentContract();
  const pauseMutation = usePausePaymentContract();
  const resumeMutation = useResumePaymentContract();
  const deductMutation = useDeductPaymentContract();
  const createPlanMutation = useCreateDeductPlan();
  const updatePlanMutation = useUpdateDeductPlan();
  const deletePlanMutation = useDeleteDeductPlan();

  // ── 协议操作 ──
  async function handleCreateContract() {
    let values: ContractFormValues;
    try { values = (await contractFormApi.current?.validate()) as ContractFormValues; } catch { throw new Error('validation'); }
    const res = await createContractMutation.mutateAsync({
      planId: values.planId,
      payMethod: values.payMethod,
      signerAccount: values.signerAccount,
      signerName: values.signerName || undefined,
      remark: values.remark || undefined,
      firstDeductNow: values.firstDeductNow ?? true,
    });
    if (res.firstDeduct?.deductStatus === 'success') Toast.success('签约成功，首期扣款已完成');
    else if (res.firstDeduct?.deductStatus === 'failed') Toast.warning(`签约成功，但首期扣款失败：${res.firstDeduct.failReason ?? '未知原因'}`);
    else Toast.success('签约成功');
    setContractModal(false);
  }

  async function handleTerminate(id: number) {
    await terminateMutation.mutateAsync(id);
    Toast.success('已解约');
  }

  async function handlePause(id: number) {
    await pauseMutation.mutateAsync(id);
    Toast.success('已暂停扣款');
  }

  async function handleResume(id: number) {
    await resumeMutation.mutateAsync(id);
    Toast.success('已恢复，将尽快执行补扣');
  }

  async function handleDeduct(id: number) {
    const res = await deductMutation.mutateAsync(id);
    if (res.deductStatus === 'success') Toast.success(`扣款成功（订单 ${res.orderNo}）`);
    else if (res.deductStatus === 'processing') Toast.info('渠道受理中，稍后自动同步结果');
    else Toast.error(`扣款失败：${res.failReason ?? '未知原因'}`);
  }

  // ── 计划操作 ──
  function openCreatePlan() { setEditingPlan(null); setPlanPeriod('monthly'); setPlanModal(true); }
  function openEditPlan(p: PaymentDeductPlan) { setEditingPlan(p); setPlanPeriod(p.period); setPlanModal(true); }
  const planInit: PlanFormValues = editingPlan
    ? { name: editingPlan.name, period: editingPlan.period, customDays: editingPlan.customDays ?? undefined, amountYuan: editingPlan.amount / 100, maxRetries: editingPlan.maxRetries, status: editingPlan.status, remark: editingPlan.remark ?? '' }
    : { name: '', period: 'monthly', amountYuan: 15, maxRetries: 3, status: 'enabled' };

  async function handlePlanOk() {
    let values: PlanFormValues;
    try { values = (await planFormApi.current?.validate()) as PlanFormValues; } catch { throw new Error('validation'); }
    const payload = {
      name: values.name,
      period: values.period,
      customDays: values.period === 'custom' ? values.customDays : null,
      amount: Math.round(values.amountYuan * 100),
      maxRetries: values.maxRetries,
      status: values.status,
      remark: values.remark || undefined,
    };
    if (editingPlan) {
      await updatePlanMutation.mutateAsync({ id: editingPlan.id, values: payload });
      Toast.success('更新成功');
    } else {
      await createPlanMutation.mutateAsync(payload);
      Toast.success('创建成功');
    }
    setPlanModal(false);
    setEditingPlan(null);
  }

  async function handleDeletePlan(id: number) {
    await deletePlanMutation.mutateAsync(id);
    Toast.success('删除成功');
  }

  // ── 列定义 ──
  const contractColumns: ColumnProps<PaymentContract>[] = [
    { title: '协议号', dataIndex: 'contractNo', width: 190, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} copyable={{ content: v }} style={{ maxWidth: 170 }}>{v}</Typography.Text> },
    { title: '渠道', dataIndex: 'channel', width: 90, render: (v: PaymentChannel) => PAYMENT_CHANNEL_LABELS[v] },
    { title: '扣款计划', dataIndex: 'planName', width: 200, render: (v: string | null, r) => {
      const text = v ? `${v}（${r.planPeriod ? describePlanPeriod({ period: r.planPeriod, customDays: null }) : '-'}）` : '-';
      return <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 180 }}>{text}</Typography.Text>;
    } },
    { title: '每期金额', dataIndex: 'planAmount', width: 100, render: (v: number | null) => (v == null ? '-' : yuan(v)) },
    { title: '签约账号', dataIndex: 'signerAccount', width: 160, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 140 }}>{v}</Typography.Text> },
    { title: '业务', dataIndex: 'bizType', width: 140, render: (v: string, r) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 120 }}>{`${v}:${r.bizId}`}</Typography.Text> },
    { title: '已扣期数', dataIndex: 'totalDeductCount', width: 90 },
    { title: '连续失败', dataIndex: 'failCount', width: 90, render: (v: number) => (v > 0 ? <Tag color="red">{v} 次</Tag> : '0') },
    { title: '下次扣款', dataIndex: 'nextDeductAt', width: 170, render: (v: string | null) => (v ? formatDateTime(v) : '-') },
    { title: '上次扣款', dataIndex: 'lastDeductAt', width: 190, render: (v: string | null) => (v ? formatDateTime(v) : '-') },
    createdAtColumn as ColumnProps<PaymentContract>,
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentContractStatus) => <Tag color={CONTRACT_STATUS_COLOR[v]}>{PAYMENT_CONTRACT_STATUS_LABELS[v]}</Tag> },
    createOperationColumn<PaymentContract>({
      width: 180,
      actions: (r) => (canManage ? [
        ...(r.status === 'signed' ? [{
          key: 'deduct',
          label: '补扣',
          onClick: () => {
            Modal.confirm({ title: '立即执行一期扣款？', content: `将按计划金额 ${r.planAmount != null ? yuan(r.planAmount) : ''} 发起代扣`, onOk: () => handleDeduct(r.id) });
          },
        }, {
          key: 'pause',
          label: '暂停',
          onClick: () => {
            Modal.confirm({ title: '暂停自动扣款？', content: '暂停后可随时恢复', onOk: () => handlePause(r.id) });
          },
        }] : []),
        ...(r.status === 'paused' ? [{
          key: 'resume',
          label: '恢复',
          onClick: () => {
            Modal.confirm({ title: '恢复自动扣款？', content: '恢复后将尽快执行补扣', onOk: () => handleResume(r.id) });
          },
        }] : []),
        ...(r.status !== 'terminated' ? [{
          key: 'terminate',
          label: '解约',
          danger: true,
          onClick: () => {
            Modal.confirm({ title: '确定要解约吗？', content: '解约后停止扣款，且不可恢复', onOk: () => handleTerminate(r.id) });
          },
        }] : []),
      ] : []),
    }),
  ];

  const planColumns: ColumnProps<PaymentDeductPlan>[] = [
    { title: '计划名称', dataIndex: 'name', width: 180 },
    { title: '扣款周期', dataIndex: 'period', width: 120, render: (_: unknown, p) => describePlanPeriod(p) },
    { title: '每期金额', dataIndex: 'amount', width: 110, render: (v: number) => yuan(v) },
    { title: '失败重试上限', dataIndex: 'maxRetries', width: 110 },
    { title: '签约数', dataIndex: 'contractCount', width: 90, render: (v: number | undefined) => v ?? 0 },
    { title: '备注', dataIndex: 'remark', width: 200, render: (v: string | null) => v || '-' },
    createdAtColumn as ColumnProps<PaymentDeductPlan>,
    { title: '状态', dataIndex: 'status', width: 80, fixed: 'right', render: (v: 'enabled' | 'disabled') => (v === 'enabled' ? <Tag color="green">启用</Tag> : <Tag color="grey">停用</Tag>) },
    createOperationColumn<PaymentDeductPlan>({
      width: 120,
      actions: (p) => (canPlan ? [{
        key: 'edit',
        label: '编辑',
        onClick: () => openEditPlan(p),
      }, {
        key: 'delete',
        label: '删除',
        danger: true,
        onClick: () => {
          confirmDelete({ content: '仅无签约协议引用的计划可删除', onOk: () => handleDeletePlan(p.id) });
        },
      }] : []),
    }),
  ];

  // ── 搜索 ──
  const handlePlanSearch = () => {
    setPPage(1);
    setSubmittedPlanKeyword(planKeyword);
    void queryClient.invalidateQueries({ queryKey: paymentContractKeys.planLists });
  };
  const handlePlanReset = () => {
    setPlanKeyword('');
    setPPage(1);
    setSubmittedPlanKeyword('');
    void queryClient.invalidateQueries({ queryKey: paymentContractKeys.planLists });
  };

  const exportQuery = {
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    channel: submittedParams.channel || undefined,
  };

  const renderKeywordSearch = () => (
    <Input prefix={<Search size={14} />} placeholder="协议号/签约账号/业务ID..." value={draftParams.keyword} onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} showClear style={{ width: 220 }} onEnterPress={handleSearch} />
  );
  const renderStatusFilter = () => (
    <Select placeholder="全部状态" value={draftParams.status || undefined} onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))} showClear style={{ width: 120 }} optionList={contractStatusOptions} />
  );
  const renderChannelFilter = () => (
    <Select placeholder="全部渠道" value={draftParams.channel || undefined} onChange={(v) => setDraftParams((p) => ({ ...p, channel: (v as string) ?? '' }))} showClear style={{ width: 120 }} optionList={channelOptions} />
  );
  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderCreateContract = () => canManage ? (
    <CreateButton onClick={() => setContractModal(true)}>新增签约</CreateButton>
  ) : null;
  const renderExportButtons = () => <ExportButton entity="payment.contracts" query={exportQuery} />;

  const renderPlanKeywordSearch = () => (
    <Input prefix={<Search size={14} />} placeholder="计划名称..." value={planKeyword} onChange={setPlanKeyword} showClear style={{ width: 200 }} onEnterPress={handlePlanSearch} />
  );
  const renderPlanSearchButton = () => <SearchButton onClick={handlePlanSearch} />;
  const renderPlanResetButton = () => <ResetButton onClick={handlePlanReset} />;
  const renderCreatePlan = () => canPlan ? (
    <CreateButton onClick={openCreatePlan} />
  ) : null;

  return (
    <div className="page-container page-tabs-page">
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'contracts' | 'plans')} type="line" lazyRender keepDOM={false}>
        <TabPane tab="签约协议" itemKey="contracts">
          <SearchToolbar
            primary={(
              <>
                {renderKeywordSearch()}
                {renderStatusFilter()}
                {renderChannelFilter()}
                {renderSearchButton()}
                {renderResetButton()}
                {renderExportButtons()}
                {renderCreateContract()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderKeywordSearch()}
                {renderSearchButton()}
                {renderCreateContract()}
              </>
            )}
            mobileFilters={(
              <>
                {renderStatusFilter()}
                {renderChannelFilter()}
              </>
            )}
            filterTitle="签约协议筛选"
            onFilterApply={handleSearch}
            onFilterReset={handleReset}
            mobileActions={<ExportButton entity="payment.contracts" query={exportQuery} variant="flat" />}
          />
          <ConfigurableTable
            bordered columns={contractColumns} dataSource={contracts} loading={contractQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void contractQuery.refetch()} refreshLoading={contractQuery.isFetching} pagination={buildCPagination(contractTotal)}
          />
        </TabPane>
        <TabPane tab="扣款计划" itemKey="plans">
          <SearchToolbar
            primary={(
              <>
                {renderPlanKeywordSearch()}
                {renderPlanSearchButton()}
                {renderPlanResetButton()}
                {renderCreatePlan()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderPlanKeywordSearch()}
                {renderPlanSearchButton()}
                {renderCreatePlan()}
              </>
            )}
          />
          <ConfigurableTable
            bordered columns={planColumns} dataSource={plans} loading={planQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void planQuery.refetch()} refreshLoading={planQuery.isFetching} pagination={buildPPagination(planTotal)}
          />
        </TabPane>
      </Tabs>

      <AppModal title={editingPlan ? '编辑扣款计划' : '新增扣款计划'} visible={planModal} onOk={handlePlanOk} onCancel={() => { setPlanModal(false); setEditingPlan(null); }} okButtonProps={{ loading: createPlanMutation.isPending || updatePlanMutation.isPending }} width={520} closeOnEsc>
        <Form key={editingPlan?.id ?? 'new-plan'} getFormApi={(api) => { planFormApi.current = api; }} initValues={planInit} labelPosition="left" labelWidth={110}>
          <Form.Input field="name" label="计划名称" placeholder="如：连续包月 VIP" rules={[{ required: true, message: '计划名称不能为空' }]} />
          <Form.Select field="period" label="扣款周期" style={{ width: '100%' }} optionList={PAYMENT_DEDUCT_PERIOD_OPTIONS} onChange={(v) => setPlanPeriod(v as PaymentDeductPeriod)} rules={[{ required: true, message: '请选择周期' }]} />
          {planPeriod === 'custom' && (
            <Form.InputNumber field="customDays" label="周期天数" min={1} max={3650} style={{ width: '100%' }} rules={[{ required: true, message: '自定义周期必须填写天数' }]} />
          )}
          <Form.InputNumber field="amountYuan" label="每期金额(元)" min={0.01} step={0.01} precision={2} style={{ width: '100%' }} rules={[{ required: true, message: '每期金额不能为空' }]} />
          <Form.InputNumber field="maxRetries" label="失败重试上限" min={0} max={10} style={{ width: '100%' }} extraText="连续扣款失败达到上限后协议自动暂停" />
          <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} />
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>

      <AppModal title="新增签约（演示/测试）" visible={contractModal} onOk={handleCreateContract} onCancel={() => setContractModal(false)} okButtonProps={{ loading: createContractMutation.isPending }} width={520} closeOnEsc>
        <Form key={contractModal ? 'sign' : 'closed'} getFormApi={(api) => { contractFormApi.current = api; }} initValues={{ payMethod: 'wechat_papay', firstDeductNow: true }} labelPosition="left" labelWidth={110}>
          <Form.Select field="planId" label="扣款计划" style={{ width: '100%' }} rules={[{ required: true, message: '请选择扣款计划' }]}
            optionList={allPlans.map((p) => ({ value: p.id, label: `${p.name}（${describePlanPeriod(p)} ${yuan(p.amount)}）` }))} />
          <Form.Select field="payMethod" label="代扣方式" style={{ width: '100%' }} optionList={DEDUCT_METHOD_OPTIONS} rules={[{ required: true, message: '请选择代扣方式' }]} />
          <Form.Input field="signerAccount" label="签约账号" placeholder="微信 openid / 支付宝账号" rules={[{ required: true, message: '签约账号不能为空' }]} />
          <Form.Input field="signerName" label="签约人" placeholder="可选" />
          <Form.Switch field="firstDeductNow" label="立即首扣" extraText="签约成功后立即执行首期扣款（沙箱渠道即时成功）" />
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>
    </div>
  );
}
