import { useState } from 'react';
import { Button, Tag, Space, Modal, Form, Toast, Typography, Select, Banner, SideSheet, Descriptions } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { OPEN_WEBHOOK_DELIVERY_STATUS_LABELS, OPEN_WEBHOOK_EVENT_LABELS } from '@zenith/shared/open-platform';
import type { AppWebhookSubscription, AppWebhookDelivery } from '@zenith/shared/open-platform';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { usePermission } from '@/hooks/usePermission';
import {
  openPlatformKeys,
  useBatchRetryWebhookDeliveries,
  useDeleteWebhook,
  useOpenAppOptions,
  useRegenerateWebhookSecret,
  useRetryWebhookDelivery,
  useSaveWebhook,
  useTestWebhook,
  useWebhookDeliveries,
  useWebhookEvents,
  useWebhookList,
} from '@/hooks/queries/open-platform';
import { useDictItems } from '@/hooks/useDictItems';
import { useListSearch } from '@/hooks/useListSearch';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDanger, confirmDelete } from '@/utils/confirm';
import { useEditModal } from '@/hooks/useEditModal';
import { abortSubmit } from '@/lib/abort-submit';

const { Text, Paragraph } = Typography;

const SIGN_MODE_OPTIONS = [
  { value: 'hmacSha256', label: 'HMAC-SHA256（推荐）' },
  { value: 'none', label: '不签名' },
];

const DELIVERY_STATUS_COLOR: Record<string, 'blue' | 'green' | 'red' | 'orange'> = { pending: 'blue', success: 'green', failed: 'red', retrying: 'orange' };

type FormValues = {
  clientId: string;
  name: string;
  url: string;
  events: string[];
  signMode: 'hmacSha256' | 'none';
  headersText?: string;
  status: 'enabled' | 'disabled';
};

export default function WebhooksPage() {
  const { items: statusItems } = useDictItems('common_status');
  const STATUS_OPTIONS = statusItems.map((i) => ({ value: i.value, label: i.label }));
  const { hasPermission } = usePermission();
  const canManage = hasPermission('open:webhook:manage');

  interface SearchParams { keyword: string; clientId?: string; status?: 'enabled' | 'disabled' }
  const defaultSearchParams: SearchParams = { keyword: '', clientId: undefined, status: undefined };
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: openPlatformKeys.webhooks.lists });

  const appOptionsQuery = useOpenAppOptions();
  const eventOptionsQuery = useWebhookEvents();
  const appOptions = appOptionsQuery.data ?? [];
  const eventOptions = eventOptionsQuery.data ?? [];

  const [secretModal, setSecretModal] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState('');

  // 投递日志抽屉
  const [drawerSub, setDrawerSub] = useState<AppWebhookSubscription | null>(null);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [detailDelivery, setDetailDelivery] = useState<AppWebhookDelivery | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<AppWebhookDelivery['status'] | undefined>();
  const [deliveryEventType, setDeliveryEventType] = useState<string | undefined>();
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);

  const listQuery = useWebhookList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    clientId: submittedParams.clientId,
    status: submittedParams.status,
  });
  const data = listQuery.data ?? null;
  const deliveryQuery = useWebhookDeliveries({
    subscriptionId: drawerSub?.id,
    page: deliveryPage,
    pageSize: 10,
    status: deliveryStatus,
    eventType: deliveryEventType,
  }, !!drawerSub);
  const deliveries = deliveryQuery.data ?? null;
  const saveMutation = useSaveWebhook();
  const deleteMutation = useDeleteWebhook();
  const regenerateMutation = useRegenerateWebhookSecret();
  const testMutation = useTestWebhook();
  const retryMutation = useRetryWebhookDelivery();
  const batchRetryMutation = useBatchRetryWebhookDeliveries();
  const modal = useEditModal<AppWebhookSubscription, FormValues, Partial<Omit<FormValues, 'headersText'>> & { headers?: Record<string, string> }>({
    save: saveMutation,
    defaults: { events: [], signMode: 'hmacSha256', status: 'enabled' },
    toValues: (record) => ({
      clientId: record.clientId,
      name: record.name,
      url: record.url,
      events: record.events,
      signMode: record.signMode,
      headersText: record.headers ? JSON.stringify(record.headers, null, 2) : '',
      status: record.status,
    }),
    beforeSave: (values, { isEdit }) => {
      let headers: Record<string, string> | undefined;
      if (values.headersText && values.headersText.trim()) {
        try {
          headers = JSON.parse(values.headersText) as Record<string, string>;
        } catch {
          Toast.error('自定义请求头不是合法的 JSON');
          abortSubmit();
        }
      }
      const payload = { clientId: values.clientId, name: values.name, url: values.url, events: values.events, signMode: values.signMode, headers, status: values.status };
      if (!isEdit) return payload;
      const { clientId: _clientId, ...rest } = payload;
      return rest;
    },
    onSaved: (created, { isEdit }) => {
      if (isEdit) return;
      const secret = 'secret' in created && typeof created.secret === 'string' ? created.secret : '';
      if (secret) { setOneTimeSecret(secret); setSecretModal(true); }
    },
    labelWidth: 100,
  });

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync(id);
    Toast.success('删除成功');
  }
  async function handleRegenerate(id: number) {
    const res = await regenerateMutation.mutateAsync(id);
    if (res.secret) { setOneTimeSecret(res.secret); setSecretModal(true); }
  }
  async function handleTest(id: number) {
    await testMutation.mutateAsync(id);
    Toast.success('已发送测试投递，请在投递日志中查看结果');
  }

  // ─── 投递日志 ──────────────────────────────────────────────────────────────
  function openDeliveries(sub: AppWebhookSubscription) {
    setDrawerSub(sub);
    setDeliveryPage(1);
    setDeliveryStatus(undefined);
    setDeliveryEventType(undefined);
    setSelectedDeliveryIds([]);
  }
  async function retryDelivery(id: number) {
    await retryMutation.mutateAsync(id);
    Toast.success('已触发重试');
  }
  async function batchRetryDeliveries() {
    const result = await batchRetryMutation.mutateAsync(selectedDeliveryIds);
    setSelectedDeliveryIds([]);
    Toast.success(`已将 ${result.scheduled} 条投递加入重试队列`);
  }

  const columns: ColumnProps<AppWebhookSubscription>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 150 },
    { title: '所属应用', dataIndex: 'clientId', width: 200, render: (v: string) => <Text size="small" ellipsis={{ showTooltip: true }} style={{ maxWidth: 190 }}>{appOptions.find((a) => a.clientId === v)?.name ?? v}</Text> },
    { title: '回调地址', dataIndex: 'url', width: 240, render: (v: string) => <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 230 }}>{v}</Text> },
    {
      title: '订阅事件',
      dataIndex: 'events',
      width: 200,
      render: (v: string[]) => v.length === 0
        ? <Tag size="small" color="grey">全部事件</Tag>
        : <Space wrap>{v.map((e) => <Tag key={e} size="small" color="blue">{OPEN_WEBHOOK_EVENT_LABELS[e] ?? e}</Tag>)}</Space>,
    },
    { title: '签名', dataIndex: 'signMode', width: 90, render: (v: string) => v === 'hmacSha256' ? <Tag size="small" color="orange">HMAC</Tag> : <Text type="tertiary">无</Text> },
    { title: '最近投递', dataIndex: 'lastDeliveryAt', width: 160, render: (v: string | null) => v || <Text type="tertiary">—</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right' as const,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'grey'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>,
    },
    createOperationColumn<AppWebhookSubscription>({
      width: 200,
      desktopInlineKeys: ['deliveries', 'edit'],
      actions: (record) => [
        { key: 'deliveries', label: '投递日志', onClick: () => openDeliveries(record) },
        { key: 'edit', label: '编辑', hidden: !canManage, onClick: () => modal.openEdit(record) },
        { key: 'test', label: '测试', hidden: !canManage, onClick: () => void handleTest(record.id) },
        {
          key: 'regenerate', label: '重置密钥', hidden: !canManage || record.signMode !== 'hmacSha256',
          onClick: () => {
            confirmDanger({ title: '重置签名密钥？旧密钥将立即失效', onOk: () => handleRegenerate(record.id) });
          },
        },
        {
          key: 'delete', label: '删除', danger: true, hidden: !canManage,
          onClick: () => {
            confirmDelete({ title: '确定删除此 Webhook 订阅？', content: '关联投递日志将一并删除', onOk: () => handleDelete(record.id) });
          },
        },
      ],
    }),
  ];

  const deliveryColumns: ColumnProps<AppWebhookDelivery>[] = [
    { title: '时间', dataIndex: 'createdAt', width: 150 },
    { title: '事件', dataIndex: 'eventType', width: 130, render: (v: string) => OPEN_WEBHOOK_EVENT_LABELS[v] ?? v },
    { title: '尝试', dataIndex: 'attempt', width: 60 },
    { title: '响应码', dataIndex: 'responseStatus', width: 80, render: (v: number | null) => v ?? '—' },
    { title: '耗时', dataIndex: 'durationMs', width: 80, render: (v: number | null) => v != null ? `${v}ms` : '—' },
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right' as const,
      render: (v: string) => <Tag size="small" color={DELIVERY_STATUS_COLOR[v] ?? 'grey'}>{OPEN_WEBHOOK_DELIVERY_STATUS_LABELS[v as keyof typeof OPEN_WEBHOOK_DELIVERY_STATUS_LABELS] ?? v}</Tag>,
    },
    createOperationColumn<AppWebhookDelivery>({
      width: 120,
      actions: (record) => [
        { key: 'detail', label: '详情', onClick: () => setDetailDelivery(record) },
        { key: 'retry', label: '重试', hidden: !canManage || record.status !== 'failed', onClick: () => void retryDelivery(record.id) },
      ],
    }),
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <KeywordInput placeholder="搜索名称 / URL" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} width={200} />
            <Select placeholder="所属应用" value={draftParams.clientId} onChange={(v) => setDraftParams({ ...draftParams, clientId: v as string })} optionList={appOptions.map((a) => ({ value: a.clientId, label: a.name }))} showClear filter style={{ width: 180 }} />
            <Select placeholder="状态" value={draftParams.status} onChange={(v) => setDraftParams({ ...draftParams, status: v as 'enabled' | 'disabled' })} optionList={STATUS_OPTIONS} showClear style={{ width: 110 }} />
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
          </>
        )}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索名称 / URL" value={draftParams.keyword} onChange={(v) => setDraftParams({ ...draftParams, keyword: v })} onSearch={handleSearch} width={200} />
            <SearchButton onClick={handleSearch} />
            {canManage && <CreateButton onClick={modal.openCreate} />}
          </>
        )}
        mobileActions={<ResetButton onClick={handleReset} />}
        actionTitle="Webhook 操作"
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
        empty="暂无 Webhook 订阅"
        pagination={buildPagination(data?.total ?? 0)}
      />

      {/* 新增 / 编辑 */}
      <AppModal
        {...modal.modalProps}
        title={modal.isEdit ? '编辑 Webhook 订阅' : '新增 Webhook 订阅'}
        width={600}
      >
        <Form {...modal.formProps}>
          <Form.Select field="clientId" label="所属应用" disabled={modal.isEdit} style={{ width: '100%' }} filter optionList={appOptions.map((a) => ({ value: a.clientId, label: a.name }))} rules={[{ required: true, message: '请选择所属应用' }]} />
          <Form.Input field="name" label="名称" placeholder="如 订单回调" rules={[{ required: true, message: '名称不能为空' }]} />
          <Form.Input field="url" label="回调地址" placeholder="https://your-app.com/webhook" rules={[{ required: true, message: '请输入回调地址' }]} />
          <Form.Select field="events" label="订阅事件" multiple style={{ width: '100%' }} placeholder="留空表示订阅全部事件" optionList={eventOptions.map((e) => ({ value: e.code, label: e.label }))} />
          <Form.Select field="signMode" label="签名方式" style={{ width: '100%' }} optionList={SIGN_MODE_OPTIONS} rules={[{ required: true, message: '请选择签名方式' }]} />
          <Form.TextArea field="headersText" label="自定义请求头" placeholder='JSON 格式，如 {"X-Custom":"abc"}（可选）' rows={2} />
          <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={STATUS_OPTIONS} rules={[{ required: true, message: '请选择状态' }]} />
        </Form>
      </AppModal>

      {/* 一次性 secret */}
      <Modal title="请复制保存 Webhook 签名密钥" visible={secretModal} onCancel={() => setSecretModal(false)} footer={<Button type="primary" onClick={() => setSecretModal(false)}>我已复制，关闭</Button>} closeOnEsc={false} maskClosable={false}>
        <Banner type="warning" description="该签名密钥仅显示一次，用于校验 Webhook 请求的 X-Zenith-Signature。请立即复制保存。" style={{ marginBottom: 16 }} />
        <Paragraph copyable style={{ wordBreak: 'break-all', background: 'var(--semi-color-fill-0)', padding: 8, borderRadius: 'var(--semi-border-radius-small)' }}>{oneTimeSecret}</Paragraph>
      </Modal>

      {/* 投递日志抽屉 */}
      <SideSheet title={`投递日志 - ${drawerSub?.name ?? ''}`} visible={!!drawerSub} onCancel={() => setDrawerSub(null)} width={720}>
        <SearchToolbar>
          <Select
            placeholder="投递状态"
            value={deliveryStatus}
            onChange={(value) => {
              setDeliveryStatus(value as AppWebhookDelivery['status']);
              setDeliveryPage(1);
              setSelectedDeliveryIds([]);
            }}
            optionList={Object.entries(OPEN_WEBHOOK_DELIVERY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            showClear
            style={{ width: 130 }}
          />
          <Select
            placeholder="事件类型"
            value={deliveryEventType}
            onChange={(value) => {
              setDeliveryEventType(value as string);
              setDeliveryPage(1);
              setSelectedDeliveryIds([]);
            }}
            optionList={eventOptions.map((event) => ({ value: event.code, label: event.label }))}
            showClear
            filter
            style={{ width: 180 }}
          />
          {selectedDeliveryIds.length > 0 && canManage && (
            <Button
              type="primary"
              loading={batchRetryMutation.isPending}
              onClick={() => void batchRetryDeliveries()}
            >
              批量重试（{selectedDeliveryIds.length}）
            </Button>
          )}
        </SearchToolbar>
        <ConfigurableTable
          bordered
          columns={deliveryColumns}
          dataSource={deliveries?.list ?? []}
          loading={deliveryQuery.isFetching}
          onRefresh={() => void deliveryQuery.refetch()}
          refreshLoading={deliveryQuery.isFetching}
          rowKey="id"
          size="small"
          empty="暂无投递记录"
          rowSelection={{
            selectedRowKeys: selectedDeliveryIds,
            getCheckboxProps: (record: AppWebhookDelivery) => ({ disabled: record.status !== 'failed' }),
            onChange: (keys) => setSelectedDeliveryIds((keys as number[]) ?? []),
          }}
          pagination={{
            currentPage: deliveryPage,
            pageSize: 10,
            total: deliveries?.total ?? 0,
            onPageChange: (p: number) => setDeliveryPage(p),
          }}
        />
      </SideSheet>

      {/* 投递详情 */}
      <Modal title="投递详情" visible={!!detailDelivery} onCancel={() => setDetailDelivery(null)} footer={null} width={620}>
        {detailDelivery && (
          <Descriptions
            row
            data={[
              { key: '事件', value: OPEN_WEBHOOK_EVENT_LABELS[detailDelivery.eventType] ?? detailDelivery.eventType },
              { key: '事件 ID', value: detailDelivery.eventId },
              { key: '状态', value: OPEN_WEBHOOK_DELIVERY_STATUS_LABELS[detailDelivery.status] },
              { key: '尝试次数', value: String(detailDelivery.attempt) },
              { key: '响应码', value: detailDelivery.responseStatus ?? '—' },
              { key: '耗时', value: detailDelivery.durationMs != null ? `${detailDelivery.durationMs}ms` : '—' },
              { key: '下次重试', value: detailDelivery.nextRetryAt ?? '—' },
              { key: '错误信息', value: detailDelivery.errorMessage ?? '—' },
              { key: '响应内容', value: <Paragraph style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{detailDelivery.responseBody || '—'}</Paragraph> },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
