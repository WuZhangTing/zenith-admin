import { Form, Modal, Spin, TabPane, Tabs, Tag, Toast, Typography, withField } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import UserSelect from '@/components/UserSelect';
import { EMPTY_PLACEHOLDER, createdAtColumn, dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { StatCard, StatGrid } from '@/components/charts';
import { formatDateForApi } from '@/utils/date';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useUrlTabState } from '@/hooks/useUrlTabState';
import { useDictItems } from '@/hooks/useDictItems';
import { confirmDelete } from '@/utils/confirm';
import {
  IOT_ALARM_LEVEL_LABELS, IOT_ALARM_LEVEL_OPTIONS, IOT_ALARM_RULE_TYPE_LABELS,
  IOT_ALARM_RULE_TYPE_OPTIONS, IOT_ALARM_STATUS_LABELS, IOT_ALARM_STATUS_OPTIONS,
  IOT_COMPARE_OP_LABELS, IOT_COMPARE_OP_OPTIONS,
} from '@zenith/shared/iot';
import type { IotAlarm, IotAlarmRule } from '@zenith/shared/iot';
import { useAllIotProducts, useIotThingModel } from '@/hooks/queries/iot-products';
import { useIotDeviceList } from '@/hooks/queries/iot-devices';
import {
  iotAlarmKeys, iotAlarmRuleKeys, useDeleteIotAlarmRules, useIotAlarmList,
  useIotAlarmRuleList, useResolveIotAlarm, useSaveIotAlarmRule,
} from '@/hooks/queries/iot-alarms';

const { Text } = Typography;

const FormUserSelect = withField(UserSelect);

const ALARM_LEVEL_COLORS = { warning: 'orange', critical: 'red' } as const;

// ─── 告警记录 Tab ─────────────────────────────────────────────────────────────
interface AlarmSearchParams {
  keyword: string;
  status: string;
  level: string;
  ruleType: string;
}

const defaultAlarmSearch: AlarmSearchParams = { keyword: '', status: '', level: '', ruleType: '' };

function AlarmRecordsTab() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset, applySearch,
  } = useListSearch<AlarmSearchParams>({ defaults: defaultAlarmSearch, listKey: iotAlarmKeys.lists });

  const listQuery = useIotAlarmList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    level: submittedParams.level || undefined,
    ruleType: submittedParams.ruleType || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  // 统计卡：以最小页读取 total（复用列表契约，无需独立聚合接口）
  const todayStart = `${formatDateForApi(new Date())} 00:00:00`;
  const firingCriticalQuery = useIotAlarmList({ page: 1, pageSize: 1, status: 'firing', level: 'critical' });
  const firingWarningQuery = useIotAlarmList({ page: 1, pageSize: 1, status: 'firing', level: 'warning' });
  const todayQuery = useIotAlarmList({ page: 1, pageSize: 1, startTime: todayStart });

  const resolveMutation = useResolveIotAlarm();

  const columns: ColumnProps<IotAlarm>[] = [
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: IotAlarm['status']) => (
        <Tag size="small" color={v === 'firing' ? 'red' : 'green'}>{IOT_ALARM_STATUS_LABELS[v]}</Tag>
      ),
    },
    {
      title: '级别', dataIndex: 'level', width: 80,
      render: (v: IotAlarm['level']) => (
        <Tag size="small" color={ALARM_LEVEL_COLORS[v]}>{IOT_ALARM_LEVEL_LABELS[v]}</Tag>
      ),
    },
    {
      title: '规则', dataIndex: 'ruleName', width: 150,
      render: (v: string) => renderEllipsis(v),
    },
    {
      title: '类型', dataIndex: 'ruleType', width: 90,
      render: (v: IotAlarm['ruleType']) => IOT_ALARM_RULE_TYPE_LABELS[v],
    },
    {
      title: '设备', dataIndex: 'deviceName', width: 150,
      render: (v: string | null) => renderEllipsis(v),
    },
    {
      title: 'SN', dataIndex: 'deviceSn', width: 180,
      render: (v: string | null) => v
        ? <Text type="tertiary" size="small" style={{ whiteSpace: 'nowrap' }}>{v}</Text>
        : EMPTY_PLACEHOLDER,
    },
    {
      title: '告警内容', dataIndex: 'message', width: 260,
      render: (v: string) => renderEllipsis(v),
    },
    dateTimeColumn<IotAlarm>('触发时间', 'firedAt'),
    dateTimeColumn<IotAlarm>('恢复时间', 'resolvedAt'),
    createOperationColumn<IotAlarm>({
      width: 100,
      actions: (record) => [
        ...(hasPermission('iot:alarm:resolve') && record.status === 'firing' ? [{
          key: 'resolve', label: '处理',
          onClick: () => {
            Modal.confirm({
              title: `确认处理告警「${record.ruleName}」？`,
              content: '将标记为已恢复；若告警条件仍满足会再次触发',
              closeOnEsc: true,
              onOk: async () => {
                await resolveMutation.mutateAsync(record.id);
                Toast.success('告警已处理');
              },
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeyword = () => (
    <KeywordInput
      placeholder="搜索规则 / 设备 / 内容..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      placeholder="全部状态"
      items={IOT_ALARM_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderLevelFilter = () => (
    <StatusSelect
      placeholder="全部级别"
      items={IOT_ALARM_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      value={draftParams.level}
      onChange={(v) => setDraftParams((p) => ({ ...p, level: v }))}
    />
  );

  const renderTypeFilter = () => (
    <StatusSelect
      placeholder="全部类型"
      items={IOT_ALARM_RULE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      value={draftParams.ruleType}
      onChange={(v) => setDraftParams((p) => ({ ...p, ruleType: v }))}
    />
  );

  return (
    <>
      <StatGrid style={{ marginBottom: 12 }}>
        <StatCard
          title="告警中 · 严重"
          value={firingCriticalQuery.data?.total ?? 0}
          accent="var(--semi-color-danger)"
          onClick={() => applySearch({ ...defaultAlarmSearch, status: 'firing', level: 'critical' })}
          active={submittedParams.status === 'firing' && submittedParams.level === 'critical'}
        />
        <StatCard
          title="告警中 · 警告"
          value={firingWarningQuery.data?.total ?? 0}
          accent="var(--semi-color-warning)"
          onClick={() => applySearch({ ...defaultAlarmSearch, status: 'firing', level: 'warning' })}
          active={submittedParams.status === 'firing' && submittedParams.level === 'warning'}
        />
        <StatCard
          title="今日触发"
          value={todayQuery.data?.total ?? 0}
          sub="今天 0 点起新触发的告警数"
        />
      </StatGrid>
      <SearchToolbar
        primary={<>
          {renderKeyword()}
          {renderStatusFilter()}
          {renderLevelFilter()}
          {renderTypeFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        mobilePrimary={<>
          {renderKeyword()}
          <SearchButton onClick={handleSearch} />
        </>}
        mobileFilters={<>
          {renderStatusFilter()}
          {renderLevelFilter()}
          {renderTypeFilter()}
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
        empty="暂无告警记录"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />
    </>
  );
}

// ─── 告警规则 Tab ─────────────────────────────────────────────────────────────
interface RuleSearchParams {
  keyword: string;
  ruleType: string;
  status: string;
}

const defaultRuleSearch: RuleSearchParams = { keyword: '', ruleType: '', status: '' };

function AlarmRulesTab() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<RuleSearchParams>({ defaults: defaultRuleSearch, listKey: iotAlarmRuleKeys.lists });

  const listQuery = useIotAlarmRuleList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    ruleType: submittedParams.ruleType || undefined,
    status: submittedParams.status || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const { items: statusItems } = useDictItems('common_status');

  const modal = useEditModal<IotAlarmRule, Record<string, unknown>, Partial<IotAlarmRule>>({
    entityName: '告警规则',
    save: useSaveIotAlarmRule(),
    toValues: (r) => ({
      name: r.name,
      productId: r.productId,
      deviceId: r.deviceId,
      ruleType: r.ruleType,
      propertyIdentifier: r.propertyIdentifier,
      operator: r.operator,
      threshold: r.threshold,
      consecutiveCount: r.consecutiveCount,
      offlineMinutes: r.offlineMinutes,
      eventIdentifier: r.eventIdentifier,
      level: r.level,
      notifyUserIds: r.notifyUserIds,
      status: r.status,
    }),
    defaults: { ruleType: 'threshold', level: 'warning', consecutiveCount: 1, status: 'enabled', notifyUserIds: [] },
    beforeSave: (values, { isEdit }) => ({
      name: values.name as string,
      ...(isEdit ? {} : { productId: values.productId as number, ruleType: values.ruleType as IotAlarmRule['ruleType'] }),
      deviceId: (values.deviceId as number | undefined) ?? null,
      propertyIdentifier: (values.propertyIdentifier as string | undefined) ?? null,
      operator: (values.operator as IotAlarmRule['operator'] | undefined) ?? null,
      threshold: (values.threshold as number | undefined) ?? null,
      consecutiveCount: (values.consecutiveCount as number) || 1,
      offlineMinutes: (values.offlineMinutes as number | undefined) ?? null,
      eventIdentifier: (values.eventIdentifier as string | undefined) ?? null,
      level: values.level as IotAlarmRule['level'],
      notifyUserIds: (values.notifyUserIds as number[] | undefined) ?? [],
      status: values.status as IotAlarmRule['status'],
    }),
    labelWidth: 110,
  });

  const deleteMutation = useDeleteIotAlarmRules();

  const columns: ColumnProps<IotAlarmRule>[] = [
    {
      title: '规则名称', dataIndex: 'name', width: 170,
      render: (v: string) => renderEllipsis(v),
    },
    {
      title: '类型', dataIndex: 'ruleType', width: 90,
      render: (v: IotAlarmRule['ruleType']) => IOT_ALARM_RULE_TYPE_LABELS[v],
    },
    {
      title: '触发条件', width: 250,
      render: (_: unknown, r: IotAlarmRule) => {
        let text: string;
        if (r.ruleType === 'threshold') {
          text = `${r.propertyIdentifier} ${r.operator ? IOT_COMPARE_OP_LABELS[r.operator] : ''} ${r.threshold}${r.consecutiveCount > 1 ? `（连续 ${r.consecutiveCount} 次）` : ''}`;
        } else if (r.ruleType === 'offline') {
          text = `离线超过 ${r.offlineMinutes} 分钟`;
        } else {
          text = `上报事件 ${r.eventIdentifier}`;
        }
        return renderEllipsis(text);
      },
    },
    {
      title: '所属产品', dataIndex: 'productName', width: 170,
      render: (v: string | null) => renderEllipsis(v),
    },
    {
      title: '生效范围', dataIndex: 'deviceName', width: 140,
      render: (v: string | null) => v ? renderEllipsis(`仅 ${v}`) : '全部设备',
    },
    {
      title: '级别', dataIndex: 'level', width: 80,
      render: (v: IotAlarmRule['level']) => (
        <Tag size="small" color={ALARM_LEVEL_COLORS[v]}>{IOT_ALARM_LEVEL_LABELS[v]}</Tag>
      ),
    },
    {
      title: '接收人', width: 90, align: 'right',
      render: (_: unknown, r: IotAlarmRule) => r.notifyUserIds.length > 0 ? `${r.notifyUserIds.length} 人` : EMPTY_PLACEHOLDER,
    },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: IotAlarmRule['status']) => (
        <Tag color={v === 'enabled' ? 'green' : 'red'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>
      ),
    },
    createOperationColumn<IotAlarmRule>({
      width: 130,
      actions: (record) => [
        ...(hasPermission('iot:alarm:rule:update') ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('iot:alarm:rule:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: `确定要删除规则「${record.name}」吗？`,
              content: '历史告警记录保留，仅停止后续触发',
              onOk: async () => {
                await deleteMutation.mutateAsync([record.id]);
                Toast.success('删除成功');
              },
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeyword = () => (
    <KeywordInput
      placeholder="搜索规则名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderTypeFilter = () => (
    <StatusSelect
      placeholder="全部类型"
      items={IOT_ALARM_RULE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      value={draftParams.ruleType}
      onChange={(v) => setDraftParams((p) => ({ ...p, ruleType: v }))}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderCreateButton = () => hasPermission('iot:alarm:rule:create')
    ? <CreateButton onClick={modal.openCreate}>新增规则</CreateButton> : null;

  return (
    <>
      <SearchToolbar
        primary={<>
          {renderKeyword()}
          {renderTypeFilter()}
          {renderStatusFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderCreateButton()}
        mobilePrimary={<>
          {renderKeyword()}
          <SearchButton onClick={handleSearch} />
          {renderCreateButton()}
        </>}
        mobileFilters={<>
          {renderTypeFilter()}
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
        empty="暂无告警规则，点击「新增规则」创建第一条"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={640}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            {({ formState }) => (
              <RuleFormBody
                isEdit={modal.isEdit}
                values={formState.values as Record<string, unknown>}
              />
            )}
          </Form>
        </Spin>
      </AppModal>
    </>
  );
}

/** 规则表单体：按所选产品加载物模型联想，按规则类型切换条件字段 */
function RuleFormBody({ isEdit, values }: Readonly<{ isEdit: boolean; values: Record<string, unknown> }>) {
  const productsQuery = useAllIotProducts();
  const products = productsQuery.data ?? [];
  const productId = (values.productId as number | undefined) ?? null;
  const ruleType = (values.ruleType as string | undefined) ?? 'threshold';
  const modelQuery = useIotThingModel(productId);
  const model = modelQuery.data;
  const devicesQuery = useIotDeviceList(
    { page: 1, pageSize: 100, productId: productId ?? undefined },
    productId !== null,
  );
  const devices = devicesQuery.data?.list ?? [];
  const numericProps = (model?.properties ?? []).filter((p) => p.dataType === 'number');
  const events = model?.events ?? [];
  const { items: statusItems } = useDictItems('common_status');

  return (
    <>
      <Form.Input field="name" label="规则名称" placeholder="如：机房温度过高"
        rules={[{ required: true, message: '规则名称不能为空' }]} />
      <Form.Select
        field="productId" label="所属产品" placeholder="选择产品" style={{ width: '100%' }}
        disabled={isEdit}
        extraText={isEdit ? '所属产品不可变更' : undefined}
        optionList={products.map((p) => ({ value: p.id, label: p.name }))}
        rules={isEdit ? [] : [{ required: true, message: '请选择所属产品' }]}
      />
      <Form.Select
        field="deviceId" label="限定设备" placeholder="不限（产品下全部设备）" showClear style={{ width: '100%' }}
        optionList={devices.map((d) => ({ value: d.id, label: `${d.name}（${d.sn}）` }))}
      />
      <Form.RadioGroup field="ruleType" label="规则类型" disabled={isEdit}
        extraText={isEdit ? '规则类型不可变更' : undefined}>
        {IOT_ALARM_RULE_TYPE_OPTIONS.map((o) => (
          <Form.Radio key={o.value} value={o.value}>{o.label}</Form.Radio>
        ))}
      </Form.RadioGroup>

      {ruleType === 'threshold' && (
        <>
          <Form.Select
            field="propertyIdentifier" label="监控属性" placeholder="选择数值型属性" style={{ width: '100%' }}
            optionList={numericProps.map((p) => ({ value: p.identifier, label: `${p.name}（${p.identifier}${p.unit ? `，${p.unit}` : ''}）` }))}
            rules={[{ required: true, message: '请选择监控属性' }]}
            emptyContent={productId ? '该产品物模型没有数值型属性' : '请先选择产品'}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Select field="operator" label="比较符" style={{ width: 110 }}
              optionList={IOT_COMPARE_OP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              rules={[{ required: true, message: '必选' }]} />
            <Form.InputNumber field="threshold" label="阈值" hideButtons style={{ width: 140 }}
              rules={[{ required: true, message: '必填' }]} />
            <Form.InputNumber field="consecutiveCount" label="连续次数" min={1} max={60} style={{ width: 110 }}
              extraText="连续 N 个点满足才触发" />
          </div>
        </>
      )}
      {ruleType === 'offline' && (
        <Form.InputNumber field="offlineMinutes" label="离线时长（分钟）" min={1} max={10080} style={{ width: 200 }}
          rules={[{ required: true, message: '请填写离线时长' }]}
          extraText="设备离线超过该时长触发告警，上线自动恢复" />
      )}
      {ruleType === 'event' && (
        <Form.Select
          field="eventIdentifier" label="触发事件" placeholder="选择物模型事件" style={{ width: '100%' }}
          optionList={events.map((e) => ({ value: e.identifier, label: `${e.name}（${e.identifier}）` }))}
          rules={[{ required: true, message: '请选择触发事件' }]}
          emptyContent={productId ? '该产品物模型没有声明事件' : '请先选择产品'}
        />
      )}

      <Form.Select field="level" label="告警级别" style={{ width: 200 }}
        optionList={IOT_ALARM_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
      <FormUserSelect field="notifyUserIds" label="通知接收人" multiple placeholder="选择接收告警通知的用户"
        extraText="通过通知中心派发（站内信默认开启，用户可自行订阅邮件等渠道）；不选则只记录告警" />
      <Form.RadioGroup field="status" label="状态">
        {statusItems.map((o) => (
          <Form.Radio key={o.value} value={o.value}>{o.label}</Form.Radio>
        ))}
      </Form.RadioGroup>
    </>
  );
}

// ─── 页面 ─────────────────────────────────────────────────────────────────────
const ALARM_TABS = ['records', 'rules'] as const;

export default function IotAlarmsPage() {
  const [activeTab, setActiveTab] = useUrlTabState(ALARM_TABS, 'records');

  return (
    <div className="page-container page-tabs-page">
      <Tabs type="line" collapsible="auto" activeKey={activeTab} onChange={(k) => setActiveTab(k as typeof ALARM_TABS[number])}>
        <TabPane tab="告警记录" itemKey="records">
          <AlarmRecordsTab />
        </TabPane>
        <TabPane tab="告警规则" itemKey="rules">
          <AlarmRulesTab />
        </TabPane>
      </Tabs>
    </div>
  );
}
