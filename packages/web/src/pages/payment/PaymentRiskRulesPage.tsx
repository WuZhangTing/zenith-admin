import type { CSSProperties } from 'react';
import { useState } from 'react';
import { formatYuan } from '@/utils/payment';
import { useQueryClient } from '@tanstack/react-query';
import { Form, Modal, Select, Switch, Tabs, TabPane, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import { copyableNoColumn, createdAtColumn, dateTimeColumn } from '@/utils/table-columns';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import {
  paymentRiskKeys,
  useApprovePaymentRiskReview,
  useDeletePaymentRiskRules,
  usePaymentRiskHitList,
  usePaymentRiskReviewList,
  usePaymentRiskRuleList,
  useRejectPaymentRiskReview,
  useSavePaymentRiskRule,
} from '@/hooks/queries/payment-risk';
import { PAYMENT_CHANNEL_LABELS, PAYMENT_RISK_ACTION_LABELS, PAYMENT_RISK_DIMENSION_LABELS, PAYMENT_RISK_REVIEW_STATUS_LABELS, PAYMENT_RISK_SCOPE_LABELS } from '@zenith/shared/payment';
import type { PaymentChannel, PaymentRiskAction, PaymentRiskDimension, PaymentRiskHit, PaymentRiskReview, PaymentRiskReviewStatus, PaymentRiskRule, PaymentRiskScope } from '@zenith/shared/payment';
import { useDictItems } from '@/hooks/useDictItems';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

import { useUrlTabState } from '@/hooks/useUrlTabState';
const yuan = formatYuan;
const channelOptions = Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => ({ value, label }));
const scopeOptions = Object.entries(PAYMENT_RISK_SCOPE_LABELS).map(([value, label]) => ({ value, label }));
const actionOptions = Object.entries(PAYMENT_RISK_ACTION_LABELS).map(([value, label]) => ({ value, label }));
const dimensionOptions = Object.entries(PAYMENT_RISK_DIMENSION_LABELS).map(([value, label]) => ({ value, label }));
const reviewStatusOptions = Object.entries(PAYMENT_RISK_REVIEW_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const REVIEW_STATUS_COLOR = { pending: 'orange', approved: 'green', rejected: 'red' } as const satisfies Record<PaymentRiskReviewStatus, string>;

interface SearchParams { scope: string; status: string; }
const defaultSearch: SearchParams = { scope: '', status: '' };

interface RiskFormValues {
  name: string;
  scope: PaymentRiskScope;
  channel?: PaymentChannel;
  bizType?: string;
  singleYuan?: number;
  dailyYuan?: number;
  dailyCountLimit?: number;
  blocklist?: string[];
  allowlist?: string[];
  action?: PaymentRiskAction;
  status?: 'enabled' | 'disabled';
  remark?: string;
}

export default function PaymentRiskRulesPage() {
  const { items: statusItems } = useDictItems('common_status');
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const canReview = hasPermission('payment:risk:review');
  const [activeTab, setActiveTab] = useUrlTabState(['rules', 'hits', 'reviews'] as const, 'rules');

  // ── 规则 ──
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentRiskKeys.lists });
  const [scopeWatch, setScopeWatch] = useState<PaymentRiskScope>('global');

  // ── 拦截记录 ──
  const { page: hPage, pageSize: hPageSize, setPage: setHPage, buildPagination: buildHPagination } = usePagination();
  const [hitKeyword, setHitKeyword] = useState('');
  const [hitAction, setHitAction] = useState('');
  const [hitDimension, setHitDimension] = useState('');
  const [submittedHitParams, setSubmittedHitParams] = useState({ keyword: '', action: '', dimension: '' });

  // ── 审核队列 ──
  const { page: rPage, pageSize: rPageSize, setPage: setRPage, buildPagination: buildRPagination } = usePagination();
  const [reviewKeyword, setReviewKeyword] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [submittedReviewParams, setSubmittedReviewParams] = useState({ keyword: '', status: '' });

  const listQuery = usePaymentRiskRuleList({
    page,
    pageSize,
    scope: submittedParams.scope || undefined,
    status: submittedParams.status || undefined,
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const hitQuery = usePaymentRiskHitList({
    page: hPage,
    pageSize: hPageSize,
    keyword: submittedHitParams.keyword || undefined,
    action: submittedHitParams.action || undefined,
    dimension: submittedHitParams.dimension || undefined,
  });
  const hits = hitQuery.data?.list ?? [];
  const hitTotal = hitQuery.data?.total ?? 0;
  const reviewQuery = usePaymentRiskReviewList({
    page: rPage,
    pageSize: rPageSize,
    keyword: submittedReviewParams.keyword || undefined,
    status: submittedReviewParams.status || undefined,
  });
  const reviews = reviewQuery.data?.list ?? [];
  const reviewTotal = reviewQuery.data?.total ?? 0;

  const saveMutation = useSavePaymentRiskRule();
  const toggleMutation = useSavePaymentRiskRule();
  const deleteMutation = useDeletePaymentRiskRules();
  const approveMutation = useApprovePaymentRiskReview();
  const rejectMutation = useRejectPaymentRiskReview();
  const togglingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null;

  function handleHitSearch() { setHPage(1); setSubmittedHitParams({ keyword: hitKeyword, action: hitAction, dimension: hitDimension }); void queryClient.invalidateQueries({ queryKey: paymentRiskKeys.hitLists }); }
  function handleHitReset() { setHitKeyword(''); setHitAction(''); setHitDimension(''); setHPage(1); setSubmittedHitParams({ keyword: '', action: '', dimension: '' }); void queryClient.invalidateQueries({ queryKey: paymentRiskKeys.hitLists }); }
  function handleReviewSearch() { setRPage(1); setSubmittedReviewParams({ keyword: reviewKeyword, status: reviewStatus }); void queryClient.invalidateQueries({ queryKey: paymentRiskKeys.reviewLists }); }
  function handleReviewReset() { setReviewKeyword(''); setReviewStatus(''); setRPage(1); setSubmittedReviewParams({ keyword: '', status: '' }); void queryClient.invalidateQueries({ queryKey: paymentRiskKeys.reviewLists }); }

  const modal = useEditModal<PaymentRiskRule, RiskFormValues, Partial<PaymentRiskRule>>({
    entityName: '风控规则',
    save: saveMutation,
    defaults: { scope: 'global', status: 'enabled', action: 'block', blocklist: [], allowlist: [] },
    toValues: (record) => ({
      name: record.name,
      scope: record.scope,
      channel: record.channel ?? undefined,
      bizType: record.bizType ?? undefined,
      singleYuan: record.singleLimit != null ? record.singleLimit / 100 : undefined,
      dailyYuan: record.dailyLimit != null ? record.dailyLimit / 100 : undefined,
      dailyCountLimit: record.dailyCountLimit ?? undefined,
      blocklist: record.blocklist ?? [],
      allowlist: record.allowlist ?? [],
      action: record.action,
      status: record.status,
      remark: record.remark ?? '',
    }),
    beforeSave: (values) => ({
      name: values.name,
      scope: values.scope,
      channel: values.scope === 'channel' ? values.channel : undefined,
      bizType: values.scope === 'bizType' ? values.bizType : undefined,
      singleLimit: values.singleYuan != null ? Math.round(values.singleYuan * 100) : undefined,
      dailyLimit: values.dailyYuan != null ? Math.round(values.dailyYuan * 100) : undefined,
      dailyCountLimit: values.dailyCountLimit ?? undefined,
      blocklist: values.blocklist ?? [],
      allowlist: values.allowlist ?? [],
      action: values.action ?? 'block',
      status: values.status,
      remark: values.remark || undefined,
    }),
    labelWidth: 100,
  });

  function openCreate() { setScopeWatch('global'); modal.openCreate(); }
  function openEdit(record: PaymentRiskRule) { setScopeWatch(record.scope); modal.openEdit(record); }

  async function handleToggle(record: PaymentRiskRule, checked: boolean) {
    await toggleMutation.mutateAsync({ id: record.id, values: { status: checked ? 'enabled' : 'disabled' } });
    Toast.success(checked ? '已启用' : '已停用');
  }

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  function handleApprove(r: PaymentRiskReview) {
    Modal.confirm({
      title: '放行该交易？',
      content: `审核单 ${r.reviewNo}（${yuan(r.amount)}），放行后用户重新发起支付即可继续`,
      onOk: async () => {
        await approveMutation.mutateAsync({ id: r.id });
        Toast.success('已放行');
      },
    });
  }

  function handleReject(r: PaymentRiskReview) {
    Modal.confirm({
      title: '拒绝该交易？',
      content: `审核单 ${r.reviewNo}（${yuan(r.amount)}），拒绝后挂起订单将被关闭`,
      okButtonProps: { type: 'danger' },
      onOk: async () => {
        await rejectMutation.mutateAsync({ id: r.id });
        Toast.success('已拒绝');
      },
    });
  }

  const columns: ColumnProps<PaymentRiskRule>[] = [
    { title: '名称', dataIndex: 'name', width: 220 },
    { title: '作用域', dataIndex: 'scope', width: 100, render: (v: PaymentRiskScope) => PAYMENT_RISK_SCOPE_LABELS[v] },
    { title: '范围', dataIndex: 'channel', width: 150, render: (_: unknown, r: PaymentRiskRule) => {
      const text = r.scope === 'channel' ? (r.channel ? PAYMENT_CHANNEL_LABELS[r.channel] : '-') : r.scope === 'bizType' ? (r.bizType || '-') : '全局';
      return <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 130 }}>{text}</Typography.Text>;
    } },
    { title: '命中动作', dataIndex: 'action', width: 100, render: (v: PaymentRiskAction) => (v === 'review' ? <Tag color="orange">人工审核</Tag> : <Tag color="red">直接拦截</Tag>) },
    { title: '单笔上限', dataIndex: 'singleLimit', width: 110, render: (v: number | null) => yuan(v) },
    { title: '当日限额', dataIndex: 'dailyLimit', width: 110, align: 'right', render: (v: number | null) => yuan(v) },
    { title: '当日笔数', dataIndex: 'dailyCountLimit', width: 95, align: 'right', render: (v: number | null) => (v == null ? '-' : v) },
    { title: '黑名单', dataIndex: 'blocklist', width: 85, render: (v: string[]) => (v.length ? <Tag color="red">{v.length} 项</Tag> : '-') },
    { title: '白名单', dataIndex: 'allowlist', width: 85, render: (v: string[]) => (v.length ? <Tag color="green">{v.length} 项</Tag> : '-') },
    createdAtColumn as ColumnProps<PaymentRiskRule>,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (_: unknown, r: PaymentRiskRule) => (
        <Switch checked={r.status === 'enabled'} loading={togglingId === r.id} disabled={!hasPermission('payment:risk:update')} size="small" onChange={(c) => void handleToggle(r, c)} />
      ),
    },
    createOperationColumn<PaymentRiskRule>({
      width: 130,
      actions: (r) => [
        ...(hasPermission('payment:risk:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => openEdit(r),
        }] : []),
        ...(hasPermission('payment:risk:delete') ? [{
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({
              content: '删除后不可恢复',
              onOk: () => handleDelete(r.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  const hitColumns: ColumnProps<PaymentRiskHit>[] = [
    { title: '命中规则', dataIndex: 'ruleName', width: 140 },
    { title: '动作', dataIndex: 'action', width: 90, render: (v: PaymentRiskAction) => (v === 'review' ? <Tag color="orange">送审</Tag> : <Tag color="red">拦截</Tag>) },
    { title: '命中维度', dataIndex: 'dimension', width: 110, render: (v: PaymentRiskDimension) => PAYMENT_RISK_DIMENSION_LABELS[v] },
    { title: '命中详情', dataIndex: 'dimensionValue', width: 180, render: (v: string | null) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 160 }}>{v || '-'}</Typography.Text> },
    { title: '渠道', dataIndex: 'channel', width: 90, render: (v: PaymentChannel) => PAYMENT_CHANNEL_LABELS[v] },
    { title: '业务', dataIndex: 'bizType', width: 140, render: (v: string, r) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 120 }}>{`${v}:${r.bizId}`}</Typography.Text> },
    { title: '金额', dataIndex: 'amount', width: 100, align: 'right', render: (v: number) => yuan(v) },
    copyableNoColumn('订单号', 'orderNo'),
    { title: 'IP', dataIndex: 'clientIp', width: 120, render: (v: string | null) => v || '-' },
    dateTimeColumn('命中时间', 'createdAt', { fixed: 'right' }),
  ];

  const reviewColumns: ColumnProps<PaymentRiskReview>[] = [
    copyableNoColumn('审核单号', 'reviewNo'),
    copyableNoColumn('订单号', 'orderNo'),
    { title: '渠道', dataIndex: 'channel', width: 90, render: (v: PaymentChannel) => PAYMENT_CHANNEL_LABELS[v] },
    { title: '业务', dataIndex: 'bizType', width: 140, render: (v: string, r) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 120 }}>{`${v}:${r.bizId}`}</Typography.Text> },
    { title: '金额', dataIndex: 'amount', width: 100, align: 'right', render: (v: number) => yuan(v) },
    { title: '触发原因', dataIndex: 'reason', width: 220, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>{v}</Typography.Text> },
    { title: '审核人', dataIndex: 'reviewerName', width: 100, render: (v: string | null) => v || '-' },
    dateTimeColumn('审核时间', 'reviewedAt'),
    createdAtColumn as ColumnProps<PaymentRiskReview>,
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentRiskReviewStatus) => <Tag color={REVIEW_STATUS_COLOR[v]}>{PAYMENT_RISK_REVIEW_STATUS_LABELS[v]}</Tag> },
    createOperationColumn<PaymentRiskReview>({
      width: 130,
      actions: (r) => (canReview && r.status === 'pending' ? [{
        key: 'approve',
        label: '放行',
        onClick: () => handleApprove(r),
      }, {
        key: 'reject',
        label: '拒绝',
        danger: true,
        onClick: () => handleReject(r),
      }] : []),
    }),
  ];

  const renderScopeFilter = () => (
    <Select placeholder="全部作用域" value={draftParams.scope || undefined} onChange={(v) => setDraftParams((p) => ({ ...p, scope: (v as string) ?? '' }))} showClear style={{ width: 130 }} optionList={scopeOptions} />
  );
  const renderStatusFilter = () => (
    <Select placeholder="全部状态" value={draftParams.status || undefined} onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))} showClear style={{ width: 120 }} optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))} />
  );
  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderCreateButton = () => hasPermission('payment:risk:create') ? (
    <CreateButton onClick={openCreate} />
  ) : null;

  const renderHitKeyword = () => (
    <KeywordInput placeholder="规则名/订单号/业务ID..." value={hitKeyword} onChange={setHitKeyword} onSearch={handleHitSearch} />
  );
  const renderHitActionFilter = () => (
    <Select placeholder="全部动作" value={hitAction || undefined} onChange={(v) => setHitAction((v as string) ?? '')} showClear style={{ width: 120 }} optionList={actionOptions} />
  );
  const renderHitDimensionFilter = () => (
    <Select placeholder="全部维度" value={hitDimension || undefined} onChange={(v) => setHitDimension((v as string) ?? '')} showClear style={{ width: 140 }} optionList={dimensionOptions} />
  );

  const renderReviewKeyword = () => (
    <KeywordInput placeholder="审核单号/订单号/业务ID..." value={reviewKeyword} onChange={setReviewKeyword} onSearch={handleReviewSearch} />
  );
  const renderReviewStatusFilter = () => (
    <Select placeholder="全部状态" value={reviewStatus || undefined} onChange={(v) => setReviewStatus((v as string) ?? '')} showClear style={{ width: 120 }} optionList={reviewStatusOptions} />
  );

  return (
    <div className="page-container page-tabs-page">
      <Tabs collapsible="auto" activeKey={activeTab} onChange={(k) => setActiveTab(k as 'rules' | 'hits' | 'reviews')} type="line" lazyRender keepDOM={false}>
        <TabPane tab="限额规则" itemKey="rules">
          <SearchToolbar
            primary={(
              <>
                {renderScopeFilter()}
                {renderStatusFilter()}
                {renderSearchButton()}
                {renderResetButton()}
                {renderCreateButton()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderScopeFilter()}
                {renderSearchButton()}
                {renderCreateButton()}
              </>
            )}
            mobileFilters={renderStatusFilter()}
            filterTitle="风控规则筛选"
            onFilterApply={handleSearch}
            onFilterReset={handleReset}
          />
          <ConfigurableTable
            bordered columns={columns} dataSource={data} loading={listQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} pagination={buildPagination(total)}
          />
        </TabPane>

        <TabPane tab="拦截记录" itemKey="hits">
          <SearchToolbar
            primary={(
              <>
                {renderHitKeyword()}
                {renderHitActionFilter()}
                {renderHitDimensionFilter()}
                <SearchButton onClick={handleHitSearch} />
                <ResetButton onClick={handleHitReset} />
              </>
            )}
            mobilePrimary={(
              <>
                {renderHitKeyword()}
                <SearchButton onClick={handleHitSearch} />
              </>
            )}
            mobileFilters={(
              <>
                {renderHitActionFilter()}
                {renderHitDimensionFilter()}
              </>
            )}
            filterTitle="拦截记录筛选"
            onFilterApply={handleHitSearch}
            onFilterReset={handleHitReset}
          />
          <ConfigurableTable
            bordered columns={hitColumns} dataSource={hits} loading={hitQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void hitQuery.refetch()} refreshLoading={hitQuery.isFetching} pagination={buildHPagination(hitTotal)}
          />
        </TabPane>

        <TabPane tab="审核队列" itemKey="reviews">
          <SearchToolbar
            primary={(
              <>
                {renderReviewKeyword()}
                {renderReviewStatusFilter()}
                <SearchButton onClick={handleReviewSearch} />
                <ResetButton onClick={handleReviewReset} />
              </>
            )}
            mobilePrimary={(
              <>
                {renderReviewKeyword()}
                <SearchButton onClick={handleReviewSearch} />
              </>
            )}
            mobileFilters={renderReviewStatusFilter()}
            filterTitle="审核队列筛选"
            onFilterApply={handleReviewSearch}
            onFilterReset={handleReviewReset}
          />
          <ConfigurableTable
            bordered columns={reviewColumns} dataSource={reviews} loading={reviewQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void reviewQuery.refetch()} refreshLoading={reviewQuery.isFetching} pagination={buildRPagination(reviewTotal)}
          />
        </TabPane>
      </Tabs>

      <AppModal {...modal.modalProps} width={700}>
        <Form
          {...modal.formProps}
          onValueChange={(v) => { if (v.scope && v.scope !== scopeWatch) setScopeWatch(v.scope as PaymentRiskScope); }}
        >
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.Input field="name" label="名称" placeholder="如：大额交易拦截" rules={[{ required: true, message: '名称不能为空' }]} />
            <Form.Select field="scope" label="作用域" style={{ width: '100%' }} optionList={scopeOptions} rules={[{ required: true, message: '请选择作用域' }]} />
          </div>
          {scopeWatch === 'channel' && <Form.Select field="channel" label="渠道" style={{ width: '100%' }} optionList={channelOptions} rules={[{ required: true, message: '请选择渠道' }]} />}
          {scopeWatch === 'bizType' && <Form.Input field="bizType" label="业务类型" placeholder="如：membership" rules={[{ required: true, message: '请输入业务类型' }]} />}
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.Select field="action" label="命中动作" style={{ width: '100%' }} optionList={actionOptions} rules={[{ required: true, message: '请选择命中动作' }]} />
            <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))} />
          </div>
          <Typography.Text type="tertiary" size="small" style={{ display: 'block', margin: '-8px 0 8px 100px' }}>直接拦截=命中即拒绝下单；人工审核=订单挂起进入审核队列，放行后可继续支付</Typography.Text>
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.InputNumber field="singleYuan" label="单笔上限(元)" min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="可选" />
            <Form.InputNumber field="dailyYuan" label="当日累计(元)" min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="可选" />
          </div>
          <Form.InputNumber field="dailyCountLimit" label="当日笔数" min={0} step={1} precision={0} style={{ width: '100%' }} placeholder="可选" />
          <Form.TagInput field="blocklist" label="黑名单" placeholder="输入 openid / 用户ID / IP 后回车" />
          <Form.TagInput field="allowlist" label="白名单" placeholder="输入 openid / 用户ID / IP 后回车" />
          <Typography.Text type="tertiary" size="small" style={{ display: 'block', margin: '-8px 0 8px 100px' }}>黑名单命中执行规则动作；白名单命中跳过本规则全部检查</Typography.Text>
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>
    </div>
  );
}
