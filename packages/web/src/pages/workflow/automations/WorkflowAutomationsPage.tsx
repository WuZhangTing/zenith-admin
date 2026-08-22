import { useDictItems } from '@/hooks/useDictItems';
/**
 * 工作流流程级自动化规则管理页面
 *
 * 配置流程发起、结束（通过/驳回/撤回）后自动触发的副作用：
 *   - 自动发起另一个流程
 *   - 自动发送站内信
 *   - Webhook 回调 / 回写表单字段
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Form, Input, Row, Select, Space, Spin, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag/interface';
import { Plus, Trash2 } from 'lucide-react';
import type { WorkflowAutomation, WorkflowAutomationAction, WorkflowAutomationTrigger, WorkflowDefinition } from '@zenith/shared/workflow';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { usePermission } from '@/hooks/usePermission';
import { useWorkflowDefinitionList } from '@/hooks/queries/workflow-definitions';
import { useListSearch } from '@/hooks/useListSearch';
import {
  useDeleteWorkflowAutomations,
  useSaveWorkflowAutomation,
  useWorkflowAutomationDetail,
  useWorkflowAutomationList,
  workflowAutomationKeys,
} from '@/hooks/queries/workflow-automations';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { confirmDelete } from '@/utils/confirm';
import { useEditModal } from '@/hooks/useEditModal';
import { dateTimeColumn } from '@/utils/table-columns';
import { abortSubmit } from '@/lib/abort-submit';

const TRIGGER_OPTIONS: Array<{ value: WorkflowAutomationTrigger; label: string; color: TagColor }> = [
  { value: 'created',   label: '流程发起时', color: 'blue' },
  { value: 'approved',  label: '流程通过', color: 'green' },
  { value: 'rejected',  label: '流程驳回', color: 'red' },
  { value: 'withdrawn', label: '流程撤回', color: 'orange' },
];
const TRIGGER_LABEL_MAP = Object.fromEntries(TRIGGER_OPTIONS.map((o) => [o.value, o])) as Record<string, typeof TRIGGER_OPTIONS[number]>;

type ActionType = WorkflowAutomationAction['type'];

const ACTION_TYPE_OPTIONS: Array<{ value: ActionType; label: string }> = [
  { value: 'startWorkflow', label: '发起流程' },
  { value: 'sendMessage', label: '发送站内信' },
  { value: 'webhook', label: 'Webhook 回调' },
  { value: 'updateField', label: '回写字段' },
];

const ACTION_TYPE_META: Record<ActionType, { label: string; color: TagColor }> = {
  startWorkflow: { label: '发起流程', color: 'blue' },
  sendMessage: { label: '发送站内信', color: 'purple' },
  webhook: { label: 'Webhook 回调', color: 'cyan' },
  updateField: { label: '回写字段', color: 'green' },
};

interface ActionDraft {
  type: ActionType;
  // startWorkflow
  definitionId?: number;
  titleTemplate?: string;
  formMappingJson?: string;
  // sendMessage
  title?: string;
  content?: string;
  messageType?: 'info' | 'success' | 'warning' | 'error';
  recipientsKind?: 'initiator' | 'users';
  recipientUserIds?: string;
  buttonsJson?: string;
  // webhook
  url?: string;
  method?: 'GET' | 'POST' | 'PUT';
  headersJson?: string;
  bodyTemplate?: string;
  // updateField
  fieldsJson?: string;
}

interface FormValues {
  definitionId: number | null;
  name: string;
  trigger: WorkflowAutomationTrigger;
  status: 'enabled' | 'disabled';
  sort: number;
  actions: ActionDraft[];
}

function createDefaultActionDraft(type: ActionType): ActionDraft {
  switch (type) {
    case 'startWorkflow':
      return { type, titleTemplate: '', formMappingJson: '' };
    case 'sendMessage':
      return { type, title: '', content: '', messageType: 'info', recipientsKind: 'initiator', recipientUserIds: '', buttonsJson: '' };
    case 'webhook':
      return { type, url: '', method: 'POST', headersJson: '', bodyTemplate: '' };
    case 'updateField':
      return { type, fieldsJson: '' };
    default:
      return { type };
  }
}

type JsonRecordParseResult = { ok: true; value: Record<string, string> } | { ok: false; message: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonStringRecord(json: string): JsonRecordParseResult {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isPlainRecord(parsed)) {
      return { ok: false, message: '请输入合法的 JSON 对象' };
    }
    const entries = Object.entries(parsed);
    if (entries.some(([key, value]) => !key.trim() || typeof value !== 'string')) {
      return { ok: false, message: '请输入合法的 JSON 对象' };
    }
    return { ok: true, value: Object.fromEntries(entries) as Record<string, string> };
  } catch {
    return { ok: false, message: '请输入合法的 JSON 对象' };
  }
}

function actionToDraft(a: WorkflowAutomationAction): ActionDraft {
  if (a.type === 'startWorkflow') {
    return {
      type: 'startWorkflow',
      definitionId: a.definitionId,
      titleTemplate: a.titleTemplate ?? '',
      formMappingJson: a.formMapping ? JSON.stringify(a.formMapping, null, 2) : '',
    };
  }
  if (a.type === 'webhook') {
    return {
      type: 'webhook',
      url: a.url,
      method: a.method ?? 'POST',
      headersJson: a.headers ? JSON.stringify(a.headers, null, 2) : '',
      bodyTemplate: a.bodyTemplate ?? '',
    };
  }
  if (a.type === 'updateField') {
    return {
      type: 'updateField',
      fieldsJson: JSON.stringify(a.fields, null, 2),
    };
  }
  const recipientsKind = a.recipients === 'initiator' || a.recipients == null ? 'initiator' : 'users';
  const userIds = recipientsKind === 'users' && a.recipients && typeof a.recipients === 'object'
    ? a.recipients.userIds.join(',')
    : '';
  return {
    type: 'sendMessage',
    title: a.title,
    content: a.content,
    messageType: a.messageType ?? 'info',
    recipientsKind,
    recipientUserIds: userIds,
    buttonsJson: a.buttons ? JSON.stringify(a.buttons, null, 2) : '',
  };
}

function draftToAction(d: ActionDraft): WorkflowAutomationAction | { __error: string } {
  if (d.type === 'startWorkflow') {
    if (!d.definitionId) return { __error: '动作「发起流程」缺少目标流程' };
    let formMapping: Record<string, string> | undefined;
    if (d.formMappingJson?.trim()) {
      const parsed = parseJsonStringRecord(d.formMappingJson);
      if (!parsed.ok) return { __error: parsed.message };
      formMapping = parsed.value;
    }
    return {
      type: 'startWorkflow',
      definitionId: d.definitionId,
      ...(d.titleTemplate ? { titleTemplate: d.titleTemplate } : {}),
      ...(formMapping ? { formMapping } : {}),
    };
  }
  if (d.type === 'sendMessage') {
    if (!d.title?.trim()) return { __error: '动作「站内信」标题不能为空' };
    if (!d.content?.trim()) return { __error: '动作「站内信」内容不能为空' };
    let buttons: Array<{ text: string; url: string }> | undefined;
    if (d.buttonsJson?.trim()) {
      try {
        const parsed: unknown = JSON.parse(d.buttonsJson);
        if (!Array.isArray(parsed) || parsed.some((item) => !isPlainRecord(item))) {
          return { __error: '按钮配置必须是合法 JSON 数组' };
        }
        buttons = parsed as Array<{ text: string; url: string }>;
      } catch { return { __error: '按钮配置必须是合法 JSON 数组' }; }
    }
    const recipients = d.recipientsKind === 'users'
      ? { userIds: (d.recipientUserIds ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0) }
      : 'initiator';
    if (typeof recipients === 'object' && recipients.userIds.length === 0) {
      return { __error: '动作「站内信」自定义收件人不能为空' };
    }
    return {
      type: 'sendMessage',
      title: d.title,
      content: d.content,
      messageType: d.messageType ?? 'info',
      recipients,
      ...(buttons?.length ? { buttons } : {}),
    };
  }
  if (d.type === 'webhook') {
    if (!d.url?.trim()) return { __error: '动作「Webhook 回调」URL 不能为空' };
    let headers: Record<string, string> | undefined;
    if (d.headersJson?.trim()) {
      const parsed = parseJsonStringRecord(d.headersJson);
      if (!parsed.ok) return { __error: parsed.message };
      headers = parsed.value;
    }
    return {
      type: 'webhook',
      url: d.url.trim(),
      method: d.method ?? 'POST',
      ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
      ...(d.bodyTemplate?.trim() ? { bodyTemplate: d.bodyTemplate } : {}),
    };
  }
  if (d.type === 'updateField') {
    if (!d.fieldsJson?.trim()) return { __error: '动作「回写字段」字段配置不能为空' };
    const fields = parseJsonStringRecord(d.fieldsJson);
    if (!fields.ok) return { __error: fields.message };
    if (Object.keys(fields.value).length === 0) return { __error: '动作「回写字段」字段配置不能为空' };
    return { type: 'updateField', fields: fields.value };
  }
  return { __error: '未知动作类型' };
}

export default function WorkflowAutomationsPage() {
  const { items: statusItems } = useDictItems('common_status');
  const { hasPermission } = usePermission();
  const canEditAutomation = hasPermission('workflow:definition:edit');

  interface SearchParams { definitionId: number | ''; trigger: WorkflowAutomationTrigger | ''; status: 'enabled' | 'disabled' | '' }
  const defaultSearchParams: SearchParams = { definitionId: '', trigger: '', status: '' };
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: workflowAutomationKeys.lists });
  const listQuery = useWorkflowAutomationList({
    page,
    pageSize,
    definitionId: submittedParams.definitionId === '' ? undefined : submittedParams.definitionId,
    trigger: submittedParams.trigger || undefined,
    status: submittedParams.status || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const definitionsQuery = useWorkflowDefinitionList({ page: 1, pageSize: 200 });
  const defs: WorkflowDefinition[] = useMemo(() => definitionsQuery.data?.list ?? [], [definitionsQuery.data]);

  const [actions, setActions] = useState<ActionDraft[]>([]);
  const saveMutation = useSaveWorkflowAutomation();
  const deleteMutation = useDeleteWorkflowAutomations();


  const addAction = (type: ActionDraft['type']) => {
    setActions((prev) => [...prev, createDefaultActionDraft(type)]);
  };

  const removeAction = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const changeActionType = (idx: number, type: ActionType) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? (a.type === type ? a : createDefaultActionDraft(type)) : a)));
  };

  const patchAction = (idx: number, patch: Partial<ActionDraft>) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const automationModal = useEditModal<WorkflowAutomation, FormValues, Record<string, unknown>>({
    entityName: '自动化规则',
    save: saveMutation,
    useDetail: useWorkflowAutomationDetail,
    defaults: { definitionId: null, name: '', trigger: 'approved', status: 'enabled', sort: 0, actions: [] },
    toValues: (row) => ({ definitionId: row.definitionId, name: row.name, trigger: row.trigger, status: row.status, sort: row.sort, actions: [] }),
    beforeSave: (vals) => {
      const sourceActions = actions;
      if (sourceActions.length === 0) { Toast.error('至少配置一个动作'); abortSubmit('validation'); }
      if (sourceActions.length > 10) { Toast.error('最多配置 10 个动作'); abortSubmit('validation'); }
    const built: WorkflowAutomationAction[] = [];
      for (const d of sourceActions) {
      const r = draftToAction(d);
        if ('__error' in r) { Toast.error(r.__error); abortSubmit('validation'); }
      built.push(r);
    }
      return {
      definitionId: vals.definitionId,
      name: vals.name,
      trigger: vals.trigger,
      status: vals.status,
      sort: vals.sort ?? 0,
      actions: built,
      };
    },
    successMessage: ({ isEdit }) => (isEdit ? '已更新' : '已创建'),
    labelWidth: 96,
  });
  useEffect(() => {
    if (!automationModal.visible) return;
    setActions((automationModal.editing?.actions ?? []).map(actionToDraft));
  }, [automationModal.visible, automationModal.editing]);

  const openCreate = () => {
    setActions([]);
    automationModal.openCreate();
  };

  const openEdit = (row: WorkflowAutomation) => {
    setActions(row.actions.map(actionToDraft));
    automationModal.openEdit(row);
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync([id]);
    Toast.success('已删除');
  };

  const defOptions = useMemo(
    () => defs.map((d) => ({ value: d.id, label: d.name })),
    [defs],
  );
  const launchableDefOptions = useMemo(
    () => defs.filter((d) => d.formType !== 'external').map((d) => ({ value: d.id, label: d.name })),
    [defs],
  );

  const columns: ColumnProps<WorkflowAutomation>[] = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '所属流程', dataIndex: 'definitionName', width: 200,
      render: (_v, r) => r.definitionName ?? `#${r.definitionId}` },
    { title: '名称', dataIndex: 'name', width: 200 },
    {
      title: '触发时机', dataIndex: 'trigger', width: 110,
      render: (v: WorkflowAutomationTrigger) => {
        const t = TRIGGER_LABEL_MAP[v];
        return t ? <Tag color={t.color}>{t.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '动作数', dataIndex: 'actions', width: 90,
      render: (v: WorkflowAutomationAction[]) => v?.length ?? 0,
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    dateTimeColumn('更新时间', 'updatedAt'),
    // 固定列必须连续贴在两端：状态若夹在中间，会被抽到右侧固定层，原位留下空洞，表头表体错位
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (v: string) => v === 'enabled' ? <Tag color="green">启用</Tag> : <Tag color="grey">禁用</Tag>,
    },
    createOperationColumn<WorkflowAutomation>({
      width: 160,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !canEditAutomation,
          onClick: () => openEdit(record),
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canEditAutomation,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该规则吗？',
              onOk: () => handleDelete(record.id),
            });
          },
        },
      ],
    }),
  ];

  const renderDefinitionFilter = () => (
    <Select
      placeholder="所属流程"
      value={draftParams.definitionId === '' ? undefined : draftParams.definitionId}
      onChange={(v) => setDraftParams(prev => ({ ...prev, definitionId: (v as number) ?? '' }))}
      showClear
      style={{ width: 220 }}
      optionList={launchableDefOptions}
    />
  );

  const renderTriggerFilter = () => (
    <Select
      placeholder="触发时机"
      value={draftParams.trigger || undefined}
      onChange={(v) => setDraftParams(prev => ({ ...prev, trigger: (v as WorkflowAutomationTrigger) ?? '' }))}
      showClear
      style={{ width: 140 }}
      optionList={TRIGGER_OPTIONS}
    />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams(prev => ({ ...prev, status: (v as 'enabled' | 'disabled') ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))}
    />
  );

  const renderSearchButton = () => (
    <SearchButton onClick={handleSearch} />
  );

  const renderResetButton = () => (
    <ResetButton onClick={handleReset} />
  );

  const renderCreateButton = () => canEditAutomation ? (
    <CreateButton onClick={openCreate} />
  ) : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderDefinitionFilter()}
            {renderTriggerFilter()}
            {renderStatusFilter()}
            {renderSearchButton()}
            {renderResetButton()}
            {renderCreateButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderDefinitionFilter()}
            {renderSearchButton()}
            {renderCreateButton()}
          </>
        )}
        mobileFilters={(
          <>
            {renderTriggerFilter()}
            {renderStatusFilter()}
          </>
        )}
        filterTitle="自动化规则筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable<WorkflowAutomation>
        bordered
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowKey="id"
        dataSource={list}
        columns={columns}
        pagination={buildPagination(total)}
      />

      <AppModal
        {...automationModal.modalProps}
        closeOnEsc
        width={780}
      >
        <Spin spinning={automationModal.detailLoading} wrapperClassName="modal-spin-wrapper">
        <Form key={automationModal.formKey} {...automationModal.formProps}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Input field="name" label="规则名称" maxLength={64} rules={[{ required: true, message: '请输入规则名称' }]} />
            </Col>
            <Col span={12}>
              <Form.Select
                field="definitionId" label="所属流程" filter
                style={{ width: '100%' }}
                rules={[{ required: true, message: '请选择所属流程' }]}
                optionList={defOptions}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Select field="trigger" label="触发时机" style={{ width: '100%' }} rules={[{ required: true }]} optionList={TRIGGER_OPTIONS} />
            </Col>
            <Col span={12}>
              <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.InputNumber field="sort" label="排序" style={{ width: '100%' }} min={0} max={9999} helpText="越小越先执行" />
            </Col>
          </Row>
        </Form>

        <Typography.Title heading={6} style={{ marginTop: 16 }}>动作列表</Typography.Title>
        <Typography.Text type="tertiary" size="small">
          支持模板变量：<code>{'{{title}}'}</code> <code>{'{{initiator}}'}</code> <code>{'{{instanceId}}'}</code> <code>{'{{status}}'}</code> 以及 <code>{'{{formData.xxx}}'}</code>
        </Typography.Text>

        <div style={{ marginTop: 12 }}>
          {actions.map((a, idx) => (
            <div key={`${a.type}-${idx}`} style={{ border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)', padding: 12, marginBottom: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                <Space>
                  <Tag color={ACTION_TYPE_META[a.type].color}>{ACTION_TYPE_META[a.type].label}</Tag>
                  <Select
                    value={a.type}
                    onChange={(v) => changeActionType(idx, v as ActionType)}
                    optionList={ACTION_TYPE_OPTIONS}
                    style={{ width: 150 }}
                    size="small"
                  />
                </Space>
                <Button size="small" theme="borderless" type="danger" icon={<Trash2 size={14} />} onClick={() => removeAction(idx)} />
              </Space>

              {a.type === 'startWorkflow' ? (
                <Space vertical align="start" style={{ width: '100%' }}>
                  <Select
                    placeholder="目标流程"
                    value={a.definitionId}
                    onChange={(v) => patchAction(idx, { definitionId: v as number })}
                    optionList={defOptions}
                    filter style={{ width: '100%' }}
                  />
                  <Input
                    placeholder="标题模板（可选）例：{{initiator}} 后续审批"
                    value={a.titleTemplate ?? ''}
                    onChange={(v) => patchAction(idx, { titleTemplate: v })}
                  />
                  <TextArea
                    placeholder={'表单映射（可选，JSON 对象）\n例：{\n  "amount": "{{formData.amount}}",\n  "remark": "来自 {{title}}"\n}'}
                    value={a.formMappingJson ?? ''}
                    onChange={(v: string) => patchAction(idx, { formMappingJson: v })}
                    autosize={{ minRows: 2, maxRows: 6 }}
                  />
                </Space>
              ) : a.type === 'sendMessage' ? (
                <Space vertical align="start" style={{ width: '100%' }}>
                  <Input
                    placeholder="标题（支持模板变量）"
                    value={a.title ?? ''}
                    onChange={(v) => patchAction(idx, { title: v })}
                  />
                  <TextArea
                    placeholder="内容（支持模板变量）"
                    value={a.content ?? ''}
                    onChange={(v: string) => patchAction(idx, { content: v })}
                    autosize={{ minRows: 2, maxRows: 6 }}
                  />
                  <Select
                    value={a.messageType ?? 'info'}
                    onChange={(v) => patchAction(idx, { messageType: v as ActionDraft['messageType'] })}
                    style={{ width: 160 }}
                    optionList={[
                      { value: 'info', label: '消息（普通）' },
                      { value: 'success', label: '消息（成功）' },
                      { value: 'warning', label: '消息（警告）' },
                      { value: 'error', label: '消息（错误）' },
                    ]}
                  />
                  <Select
                    value={a.recipientsKind ?? 'initiator'}
                    onChange={(v) => patchAction(idx, { recipientsKind: v as 'initiator' | 'users' })}
                    style={{ width: 200 }}
                    optionList={[
                      { value: 'initiator', label: '发起人' },
                      { value: 'users', label: '指定用户（多个用逗号分隔 ID）' },
                    ]}
                  />
                  {a.recipientsKind === 'users' && (
                    <Input
                      placeholder="用户 ID 列表，例：1,2,3"
                      value={a.recipientUserIds ?? ''}
                      onChange={(v) => patchAction(idx, { recipientUserIds: v })}
                    />
                  )}
                  <TextArea
                    placeholder={'按钮配置（可选，JSON 数组）\n例：[{ "text": "查看详情", "url": "https://..." }]'}
                    value={a.buttonsJson ?? ''}
                    onChange={(v: string) => patchAction(idx, { buttonsJson: v })}
                    autosize={{ minRows: 2, maxRows: 5 }}
                  />
                </Space>
              ) : a.type === 'webhook' ? (
                <Space vertical align="start" style={{ width: '100%' }}>
                  <Input
                    placeholder="Webhook URL（必填）"
                    value={a.url ?? ''}
                    onChange={(v) => patchAction(idx, { url: v })}
                  />
                  <Select
                    value={a.method ?? 'POST'}
                    onChange={(v) => patchAction(idx, { method: v as ActionDraft['method'] })}
                    style={{ width: 160 }}
                    optionList={[
                      { value: 'GET', label: 'GET' },
                      { value: 'POST', label: 'POST' },
                      { value: 'PUT', label: 'PUT' },
                    ]}
                  />
                  <TextArea
                    placeholder={'请求头（可选，JSON 对象）\n例：{\n  "X-Flow-Title": "{{title}}",\n  "Content-Type": "application/json"\n}'}
                    value={a.headersJson ?? ''}
                    onChange={(v: string) => patchAction(idx, { headersJson: v })}
                    autosize={{ minRows: 2, maxRows: 6 }}
                  />
                  <TextArea
                    placeholder={'请求体模板（可选）\n支持 {{title}}、{{initiator}}、{{fieldKey}} 等变量'}
                    value={a.bodyTemplate ?? ''}
                    onChange={(v: string) => patchAction(idx, { bodyTemplate: v })}
                    autosize={{ minRows: 2, maxRows: 6 }}
                  />
                </Space>
              ) : (
                <Space vertical align="start" style={{ width: '100%' }}>
                  <TextArea
                    placeholder={'回写字段（必填，JSON 对象）\n例：{\n  "status": "已处理",\n  "processedBy": "{{initiator}}",\n  "sourceTitle": "{{title}}"\n}'}
                    value={a.fieldsJson ?? ''}
                    onChange={(v: string) => patchAction(idx, { fieldsJson: v })}
                    autosize={{ minRows: 3, maxRows: 8 }}
                  />
                </Space>
              )}
            </div>
          ))}
        </div>

        <Space>
          <Button icon={<Plus size={14} />} onClick={() => addAction('startWorkflow')}>添加「发起流程」</Button>
          <Button icon={<Plus size={14} />} onClick={() => addAction('sendMessage')}>添加「站内信」</Button>
          <Button icon={<Plus size={14} />} onClick={() => addAction('webhook')}>添加「Webhook」</Button>
          <Button icon={<Plus size={14} />} onClick={() => addAction('updateField')}>添加「回写字段」</Button>
        </Space>
        </Spin>
      </AppModal>
    </div>
  );
}
