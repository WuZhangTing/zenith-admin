import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Form, Space, Spin, Toast, Switch, Tag, Row, Col, Select } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import AppModal from '@/components/AppModal';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { usePagination } from '@/hooks/usePagination';
import type { MonitorAlertRule, MonitorMetric } from '@zenith/shared/platform';
import { BASIC_COMPARISON_OPERATOR_LABELS } from '@zenith/shared/core';
import { NOTIFY_CHANNEL_LABELS } from '@zenith/shared/messaging';
import {
  monitorAlertKeys,
  useDeleteMonitorAlerts,
  useMonitorAlertList,
  useSaveMonitorAlert,
  useToggleMonitorAlert,
} from '@/hooks/queries/monitor-alerts';
import {
  MONITOR_ALERT_LEVEL_CONFIG as LEVEL_CONFIG,
  MONITOR_METRIC_GROUPED_OPTIONS as METRIC_GROUPS,
  MONITOR_METRIC_LABELS as METRIC_LABELS,
  MONITOR_METRIC_META as METRIC_META,
  formatMonitorMetricValue,
} from './constants';
import { CreateButton, ResetButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';
import { dateTimeColumn } from '@/utils/table-columns';

const OP_SYMBOL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };
const OP_OPTIONS = (['gt', 'gte', 'lt', 'lte'] as const)
  .map((value) => ({ value, label: BASIC_COMPARISON_OPERATOR_LABELS[value] }));
const CHANNEL_LABELS: Record<string, string> = NOTIFY_CHANNEL_LABELS;

/** 阈值输入提示随指标单位变化：百分比与吞吐的量级差了 7 个数量级，统一文案必然误导 */
function thresholdHint(metric: MonitorMetric | undefined): string {
  switch (metric ? METRIC_META[metric]?.unit : undefined) {
    case 'percent': return '填 0-100 的百分比数值';
    case 'bps': return '填字节/秒，如 10485760 = 10 MB/s';
    case 'ms': return '填毫秒数';
    case 'count': return '填条目数量';
    case 'score': return '填 0-100 的评分（通常搭配 < 使用）';
    default: return '填数值阈值';
  }
}

export default function AlertRulesPage() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState('');
  const { page, pageSize, buildPagination } = usePagination();
  const listQuery = useMonitorAlertList({ page, pageSize });
  const data = listQuery.data ?? null;

  const canCreate = hasPermission('alert:rule:create');
  const canUpdate = hasPermission('alert:rule:update');
  const canDelete = hasPermission('alert:rule:delete');
  const saveMutation = useSaveMonitorAlert();
  const alertModal = useEditModal<MonitorAlertRule, Record<string, unknown>, Record<string, unknown>>({
    entityName: '告警规则',
    save: saveMutation,
    defaults: { operator: 'gt', level: 'warning', channels: ['inapp'], durationMinutes: 0, silenceMinutes: 30, enabled: true, recipients: [] },
    toValues: (rule) => ({
      name: rule.name,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      durationMinutes: rule.durationMinutes,
      level: rule.level,
      channels: rule.channels,
      webhookUrl: rule.webhookUrl ?? '',
      recipients: rule.recipients,
      silenceMinutes: rule.silenceMinutes,
      enabled: rule.enabled,
    }),
    beforeSave: (values) => ({ ...values, webhookUrl: (values.webhookUrl as string) || null }),
  });
  const deleteMutation = useDeleteMonitorAlerts();
  const toggleMutation = useToggleMonitorAlert();
  const togglingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null;

  const filtered = (data?.list ?? []).filter((r) => !keyword || r.name.toLowerCase().includes(keyword.toLowerCase()));

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  function handleToggle(record: MonitorAlertRule, checked: boolean) {
    toggleMutation.mutate(
      { id: record.id, enabled: checked },
      { onSuccess: () => Toast.success(checked ? '已启用' : '已停用') },
    );
  }

  const columns: ColumnProps<MonitorAlertRule>[] = [
    { title: '规则名称', dataIndex: 'name', width: 180, fixed: 'left' },
    {
      title: '触发条件',
      dataIndex: 'metric',
      width: 230,
      render: (_: unknown, r: MonitorAlertRule) => (
        <span>
          <Tag size="small" type="ghost">{METRIC_LABELS[r.metric] ?? r.metric}</Tag>
          {' '}{OP_SYMBOL[r.operator] ?? r.operator}{' '}
          <b>{formatMonitorMetricValue(r.metric, r.threshold)}</b>
          {r.durationMinutes > 0 ? <span style={{ color: 'var(--semi-color-text-2)' }}> · 持续{r.durationMinutes}分</span> : null}
        </span>
      ),
    },
    {
      title: '级别', dataIndex: 'level', width: 80,
      render: (v: string) => <Tag color={LEVEL_CONFIG[v]?.color ?? 'grey'} size="small">{LEVEL_CONFIG[v]?.label ?? v}</Tag>,
    },
    {
      title: '通知渠道', dataIndex: 'channels', width: 160,
      render: (chs: string[]) => chs?.length ? <Space spacing={4}>{chs.map((c) => <Tag key={c} size="small" type="light">{CHANNEL_LABELS[c] ?? c}</Tag>)}</Space> : <span style={{ color: 'var(--semi-color-text-2)' }}>—</span>,
    },
    {
      title: '当前值', dataIndex: 'lastValue', width: 100,
      render: (v: number | null, r: MonitorAlertRule) => v === null ? '—' : formatMonitorMetricValue(r.metric, v),
    },
    dateTimeColumn('最近触发', 'lastTriggeredAt', { empty: '从未' }),
    {
      title: '告警状态', dataIndex: 'state', width: 100, fixed: 'right',
      render: (state: string) => state === 'firing'
        ? <Tag color="red" size="small">告警中</Tag>
        : <Tag color="green" size="small">未触发</Tag>,
    },
    {
      title: '启用状态', dataIndex: 'enabled', width: 100, fixed: 'right',
      render: (enabled: boolean, r: MonitorAlertRule) => (
        <Switch
          checked={enabled}
          loading={togglingId === r.id}
          disabled={!canUpdate}
          onChange={(checked) => handleToggle(r, checked)}
          size="small"
        />
      ),
    },
    createOperationColumn<MonitorAlertRule>({
      width: 120,
      actions: (record) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !canUpdate,
          onClick: () => alertModal.openEdit(record),
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canDelete,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该规则吗？',
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
            <KeywordInput placeholder="搜索规则名称..." value={keyword} onChange={setKeyword} />
            <ResetButton onClick={() => { setKeyword(''); void queryClient.invalidateQueries({ queryKey: monitorAlertKeys.lists }); }} />
            {canCreate && <CreateButton onClick={alertModal.openCreate}>新增规则</CreateButton>}
          </>
        )}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索规则名称..." value={keyword} onChange={setKeyword} />
            {canCreate && <CreateButton onClick={alertModal.openCreate}>新增规则</CreateButton>}
          </>
        )}
        mobileActions={(
          <ResetButton onClick={() => { setKeyword(''); void queryClient.invalidateQueries({ queryKey: monitorAlertKeys.lists }); }} />
        )}
        actionTitle="告警规则操作"
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={filtered}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无告警规则"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(data?.total ?? 0)}
      />

      <AppModal
        {...alertModal.modalProps}
        width={660}
      >
        <Spin spinning={alertModal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form {...alertModal.formProps}>
            {({ values }) => {
              const selectedMetric = values.metric as MonitorMetric | undefined;
              return (
                <>
                  <Form.Input field="name" label="规则名称" placeholder="如：CPU 使用率过高" rules={[{ required: true, message: '请输入规则名称' }]} />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Select
                        field="metric"
                        label="监控指标"
                        style={{ width: '100%' }}
                        filter
                        extraText={selectedMetric ? METRIC_META[selectedMetric]?.description : undefined}
                        rules={[{ required: true, message: '请选择指标' }]}
                      >
                        {METRIC_GROUPS.map((group) => (
                          <Select.OptGroup key={group.group} label={group.label}>
                            {group.children.map((option) => (
                              <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
                            ))}
                          </Select.OptGroup>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col span={12}>
                      <Form.Select field="operator" label="比较符" style={{ width: '100%' }} optionList={OP_OPTIONS} rules={[{ required: true }]} />
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.InputNumber field="threshold" label="阈值" style={{ width: '100%' }} placeholder={thresholdHint(selectedMetric)} rules={[{ required: true, message: '请输入阈值' }]} />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber field="durationMinutes" label="持续达标" min={0} max={1440} suffix="分钟" style={{ width: '100%' }} />
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Select field="level" label="告警级别" style={{ width: '100%' }} optionList={Object.entries(LEVEL_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber field="silenceMinutes" label="静默期" min={0} max={10080} suffix="分钟" style={{ width: '100%' }} />
                    </Col>
                  </Row>
                  <Form.Select field="channels" label="通知渠道" multiple style={{ width: '100%' }} optionList={Object.entries(CHANNEL_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                  <Form.Input field="webhookUrl" label="Webhook" placeholder="https://example.com/webhook（选 Webhook 渠道时必填）" />
                  <Form.TagInput
                    field="recipients"
                    label="接收人"
                    placeholder="邮箱或用户名，回车添加，可多个"
                    extraText="邮件渠道按邮箱投递；站内信渠道按邮箱或用户名匹配启用中的用户"
                    style={{ width: '100%' }}
                  />
                  <Form.Switch field="enabled" label="启用" />
                </>
              );
            }}
          </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
