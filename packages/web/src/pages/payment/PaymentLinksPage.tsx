import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { formatYuan } from '@/utils/payment';
import { downloadBlob } from '@/utils/download';
import { Button, Form, Input, Select, Space, Switch, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { QRCodeSVG } from 'qrcode.react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import { formatDateTimeForApi } from '@/utils/date';
import { createdAtColumn, dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { PAYMENT_METHOD_LABELS, PAYMENT_LINK_STATUS_LABELS } from '@zenith/shared/payment';
import type { PaymentLink, PaymentLinkStatus, PaymentMethod } from '@zenith/shared/payment';
import { paymentLinkKeys, useDeletePaymentLinks, usePaymentLinkDetail, usePaymentLinkList, useRotatePaymentLinkToken, useSavePaymentLink } from '@/hooks/queries/payment-links';
import { useEnsureShortLink } from '@/hooks/queries/short-links';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDanger, confirmDelete } from '@/utils/confirm';

const yuan = (cents: number | null | undefined) => formatYuan(cents, '用户填写');
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }));
const LINK_STATUS_COLOR = { active: 'green', disabled: 'grey', expired: 'red' } as const satisfies Record<PaymentLinkStatus, string>;

function publicUrl(token: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const publicPath = `/public/payment/link/${token}`;
  if (import.meta.env.VITE_ELECTRON === 'true') return `${window.location.origin}${base}/#${publicPath}`;
  return `${window.location.origin}${base}${publicPath}`;
}

interface SearchParams { keyword: string; status: string; }
const defaultSearch: SearchParams = { keyword: '', status: '' };

interface LinkFormValues {
  subject: string;
  amountYuan?: number;
  payMethod?: PaymentMethod;
  bizType: string;
  maxUses?: number;
  expiredAt?: Date;
  status?: 'active' | 'disabled';
  remark?: string;
}

export default function PaymentLinksPage() {
  const { hasPermission } = usePermission();
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentLinkKeys.lists });

  const [qrLink, setQrLink] = useState<PaymentLink | null>(null);
  // 当前收款码弹窗对应的短链地址；切换目标链接时重置
  const [payShortUrl, setPayShortUrl] = useState<string | null>(null);
  const ensureShortLinkMutation = useEnsureShortLink();

  const listQuery = usePaymentLinkList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
  });
  const data = listQuery.data ?? null;
  const saveMutation = useSavePaymentLink();
  const modal = useEditModal<PaymentLink, LinkFormValues, Partial<PaymentLink>>({
    entityName: '支付链接',
    save: saveMutation,
    useDetail: usePaymentLinkDetail,
    defaults: { bizType: 'general', status: 'active' },
    toValues: (record) => ({
      subject: record.subject,
      amountYuan: record.amount != null ? record.amount / 100 : undefined,
      payMethod: record.payMethod ?? undefined,
      bizType: record.bizType,
      maxUses: record.maxUses ?? undefined,
      expiredAt: record.expiredAt ? new Date(record.expiredAt) : undefined,
      status: record.status === 'disabled' ? 'disabled' : 'active',
      remark: record.remark ?? '',
    }),
    beforeSave: (values) => ({
      subject: values.subject,
      amount: values.amountYuan != null ? Math.round(values.amountYuan * 100) : undefined,
      payMethod: values.payMethod || undefined,
      bizType: values.bizType,
      maxUses: values.maxUses ?? undefined,
      expiredAt: values.expiredAt ? formatDateTimeForApi(values.expiredAt) : undefined,
      status: values.status,
      remark: values.remark || undefined,
    }),
    labelWidth: 100,
  });
  const toggleMutation = useSavePaymentLink();
  const deleteMutation = useDeletePaymentLinks();
  const rotateTokenMutation = useRotatePaymentLinkToken();
  const togglingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null;

  function handleToggle(record: PaymentLink, checked: boolean) {
    toggleMutation.mutate(
      { id: record.id, values: { status: checked ? 'active' : 'disabled' } },
      { onSuccess: () => Toast.success(checked ? '已启用' : '已停用') },
    );
  }

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  async function handleRotateToken(id: number) {
    await rotateTokenMutation.mutateAsync(id);
    Toast.success('token 已重置，旧链接已失效');
  }

  async function copyPublicLink(link: PaymentLink) {
    try {
      await navigator.clipboard.writeText(publicUrl(link.token));
      Toast.success('链接已复制');
    } catch {
      Toast.error('复制失败，请手动复制链接');
    }
  }

  async function handleGenerateShortLink() {
    if (!qrLink) return;
    const link = await ensureShortLinkMutation.mutateAsync({
      targetUrl: publicUrl(qrLink.token),
      bizType: 'payment_link',
      bizRef: String(qrLink.id),
      title: qrLink.subject,
    });
    setPayShortUrl(link.shortUrl);
    Toast.success('短链已生成，二维码已切换为短链');
  }

  async function copyShortLink() {
    if (!payShortUrl) return;
    try {
      await navigator.clipboard.writeText(payShortUrl);
      Toast.success('短链已复制');
    } catch {
      Toast.error('复制失败，请手动复制链接');
    }
  }

  function downloadQrCode() {
    if (!qrLink) return;
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) {
      Toast.error('二维码未生成');
      return;
    }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `${qrLink.linkNo}.svg`);
  }

  const columns: ColumnProps<PaymentLink>[] = [
    { title: '标题', dataIndex: 'subject', width: 180, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 160 }}>{v}</Typography.Text> },
    { title: '金额', dataIndex: 'amount', width: 110, align: 'right', render: (v: number | null) => yuan(v) },
    { title: '支付方式', dataIndex: 'payMethod', width: 130, render: (v: PaymentMethod | null) => (v ? PAYMENT_METHOD_LABELS[v] : '用户选择') },
    { title: '业务类型', dataIndex: 'bizType', width: 140, render: renderEllipsis },
    { title: '已用/上限', dataIndex: 'usedCount', width: 110, align: 'right', render: (_: unknown, r: PaymentLink) => `${r.usedCount} / ${r.maxUses ?? '∞'}` },
    dateTimeColumn('失效时间', 'expiredAt', { empty: '永久' }),
    createdAtColumn as ColumnProps<PaymentLink>,
    {
      title: '状态', dataIndex: 'status', width: 140, fixed: 'right',
      render: (_: unknown, r: PaymentLink) => (
        <Space spacing={4}>
          <Tag color={LINK_STATUS_COLOR[r.status]}>{PAYMENT_LINK_STATUS_LABELS[r.status]}</Tag>
          {hasPermission('payment:link:update') && (
            <Switch checked={r.status !== 'disabled'} loading={togglingId === r.id} size="small" onChange={(c) => handleToggle(r, c)} />
          )}
        </Space>
      ),
    },
    createOperationColumn<PaymentLink>({
      // 全权限下四个动作内联需 262px；仅保留高频的收款码与编辑，其余进「更多」
      width: 180,
      desktopInlineKeys: ['qr', 'edit'],
      actions: (r) => [
        {
          key: 'qr',
          label: '收款码',
          onClick: () => {
            setPayShortUrl(null);
            setQrLink(r);
          },
        },
        ...(hasPermission('payment:link:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => modal.openEdit(r),
        }, {
          key: 'rotate-token',
          label: '重置链接',
          loading: rotateTokenMutation.isPending && rotateTokenMutation.variables === r.id,
          onClick: () => {
            confirmDanger({
              title: '重置链接',
              content: '重置后旧链接立即失效，确定？',
              onOk: () => handleRotateToken(r.id),
            });
          },
        }] : []),
        ...(hasPermission('payment:link:delete') ? [{
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

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="标题..." value={draftParams.keyword} onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} width={200} />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={[{ value: 'active', label: '生效中' }, { value: 'disabled', label: '已停用' }]}
    />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderCreateButton = () => hasPermission('payment:link:create') ? (
    <CreateButton onClick={modal.openCreate} />
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
        filterTitle="支付链接筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered columns={columns} dataSource={data?.list ?? []} loading={listQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
        onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} pagination={buildPagination(data?.total ?? 0)}
      />

      <AppModal {...modal.modalProps} width={700}>
        <Form key={modal.formKey} {...modal.formProps}>
          <Form.Input field="subject" label="标题" placeholder="如：会员年费收款" rules={[{ required: true, message: '标题不能为空' }]} />
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.InputNumber field="amountYuan" label="金额(元)" min={0.01} step={0.01} precision={2} style={{ width: '100%' }} placeholder="留空=由用户填写" />
            <Form.Select field="payMethod" label="支付方式" style={{ width: '100%' }} optionList={methodOptions} showClear placeholder="留空=用户选择" />
          </div>
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.Input field="bizType" label="业务类型" placeholder="如：general" rules={[{ required: true, message: '业务类型不能为空' }]} />
            <Form.InputNumber field="maxUses" label="使用次数上限" min={1} step={1} precision={0} style={{ width: '100%' }} placeholder="留空=不限次" />
          </div>
          <div className="auto-grid" style={{ ['--auto-grid-min']: '220px', ['--auto-grid-cols']: 2 } as CSSProperties}>
            <Form.DatePicker field="expiredAt" label="失效时间" type="dateTime" style={{ width: '100%' }} placeholder="留空=永久有效" />
            <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={[{ value: 'active', label: '生效中' }, { value: 'disabled', label: '已停用' }]} />
          </div>
          <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
        </Form>
      </AppModal>

      <AppModal title="收款码" visible={!!qrLink} onCancel={() => setQrLink(null)} footer={null} width={420} closeOnEsc>
        {qrLink && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Typography.Title heading={6}>{qrLink.subject}</Typography.Title>
            <Typography.Text strong style={{ fontSize: 18, color: '#10b981' }}>{yuan(qrLink.amount)}</Typography.Text>
            <div ref={qrContainerRef} style={{ padding: 12, background: '#fff', borderRadius: 'var(--semi-border-radius-medium)' }}>
              <QRCodeSVG value={payShortUrl ?? publicUrl(qrLink.token)} size={200} level="M" />
            </div>
            <Input value={payShortUrl ?? publicUrl(qrLink.token)} readonly style={{ width: '100%' }} />
            <Space>
              {payShortUrl ? (
                <Button size="small" onClick={() => { void copyShortLink(); }}>复制短链</Button>
              ) : (
                <Button size="small" onClick={() => { void copyPublicLink(qrLink); }}>复制链接</Button>
              )}
              {!payShortUrl && hasPermission('shortlink:link:create') && (
                <Button size="small" loading={ensureShortLinkMutation.isPending} onClick={() => { void handleGenerateShortLink(); }}>生成短链</Button>
              )}
              <Button size="small" onClick={downloadQrCode}>下载二维码</Button>
              <Button size="small" onClick={() => window.open(payShortUrl ?? publicUrl(qrLink.token), '_blank', 'noopener')}>打开链接</Button>
            </Space>
          </div>
        )}
      </AppModal>
    </div>
  );
}
