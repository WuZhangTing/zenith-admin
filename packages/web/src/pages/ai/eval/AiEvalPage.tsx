import { useMemo, useState } from 'react';
import {
  ArrayField,
  Button,
  Form,
  Modal,
  SideSheet,
  Space,
  Table,
  TabPane,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Plus, Trash2 } from 'lucide-react';
import { ConfigurableTable } from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import AsyncTaskProgress from '@/components/AsyncTaskProgress';
import { useMyAsyncTasks } from '@/hooks/useAsyncTasks';
import { useAiEvalSets, useAiEvalRuns, useAiEvalRunDetail, useSaveAiEvalSet, useDeleteAiEvalSet, useRunAiEval, useDeleteAiEvalRun } from '@/hooks/queries/ai-eval';
import { useAiChatModels } from '@/hooks/queries/ai-providers';
import { usePermission } from '@/hooks/usePermission';
import type { AiEvalSet, AiEvalRun, AiEvalItem } from '@zenith/shared/ai';
import { CreateButton } from '@/components/toolbar-controls';
import { confirmDelete } from '@/utils/confirm';
import { useEditModal } from '@/hooks/useEditModal';
import { abortSubmit } from '@/lib/abort-submit';
import { dateTimeColumn } from '@/utils/table-columns';

const { Text, Paragraph } = Typography;

interface SetFormValues {
  name: string;
  description?: string;
  items: AiEvalItem[];
}

export default function AiEvalPage() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission('ai:eval:manage');

  const setsQuery = useAiEvalSets();
  const { tasks } = useMyAsyncTasks({ taskTypes: ['ai-eval-run'] });
  const hasRunning = tasks.some((t) => t.status === 'running' || t.status === 'pending');
  const runsQuery = useAiEvalRuns(undefined, hasRunning ? 3000 : false);
  const saveMutation = useSaveAiEvalSet();
  const deleteMutation = useDeleteAiEvalSet();
  const runMutation = useRunAiEval();
  const deleteRunMutation = useDeleteAiEvalRun();
  const modelsQuery = useAiChatModels();

  const modal = useEditModal<AiEvalSet, SetFormValues, { name: string; description: string | null; items: AiEvalItem[] }>({
    save: saveMutation,
    defaults: { items: [{ question: '' }] },
    toValues: (set) => ({ name: set.name, description: set.description ?? '', items: set.items }),
    beforeSave: (values) => {
      const items = (values.items ?? []).filter((it) => it?.question?.trim());
      if (items.length === 0) {
        Toast.error('至少添加一条评测问题');
        abortSubmit();
      }
      return { name: values.name, description: values.description || null, items };
    },
    successMessage: ({ isEdit }) => (isEdit ? '评测集已更新' : '评测集已创建'),
    labelWidth: 80,
  });
  const [runModalSet, setRunModalSet] = useState<AiEvalSet | null>(null);
  const [runModelValue, setRunModelValue] = useState('');
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const detailQuery = useAiEvalRunDetail(detailRunId);

  const modelOptions = useMemo(() => {
    const models = modelsQuery.data ?? [];
    return [
      { value: '', label: '系统默认配置' },
      ...models.map((m) => ({ value: `${m.id}:${m.model}`, label: `${m.name} / ${m.model}${m.isDefault ? '（默认）' : ''}` })),
    ];
  }, [modelsQuery.data]);

  const handleRun = async () => {
    if (!runModalSet) return;
    const [cfgStr, ...modelParts] = runModelValue.split(':');
    try {
      await runMutation.mutateAsync({
        setId: runModalSet.id,
        configId: cfgStr ? Number(cfgStr) : undefined,
        model: modelParts.join(':') || undefined,
      });
      Toast.success('评测任务已提交，可在下方运行记录查看进度');
      setRunModalSet(null);
    } catch { /* 请求层已提示 */ }
  };

  const setColumns = [
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', width: 260, render: (v: string | null) => v || '—' },
    { title: '题目数', dataIndex: 'items', width: 90, render: (v: AiEvalItem[]) => v?.length ?? 0 },
    dateTimeColumn('更新时间', 'updatedAt'),
    createOperationColumn<AiEvalSet>({
      width: 180,
      desktopInlineKeys: ['run', 'edit'],
      actions: (record) => [
        { key: 'run', label: '运行评测', type: 'primary', hidden: !canManage, onClick: () => { setRunModalSet(record); setRunModelValue(''); } },
        { key: 'edit', label: '编辑', hidden: !canManage, onClick: () => modal.openEdit(record) },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canManage,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该评测集吗？',
              content: '将级联删除全部运行记录',
              onOk: async () => {
                await deleteMutation.mutateAsync(record.id).then(() => Toast.success('已删除')).catch(() => {});
              },
            });
          },
        },
      ],
    }),
  ];

  const runColumns = [
    { title: '评测集', dataIndex: 'setName', width: 180, render: (v: string | null) => v ?? '—' },
    { title: '模型', dataIndex: 'model', width: 200, render: (v: string) => <Text code>{v}</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: AiEvalRun['status'], record: AiEvalRun) => {
        if (v === 'running') {
          const task = tasks.find((t) => (t.payload as { runId?: number } | null)?.runId === record.id);
          return task ? <AsyncTaskProgress task={task} /> : <Tag size="small" color="blue">运行中</Tag>;
        }
        return <Tag size="small" color={v === 'done' ? 'green' : 'red'}>{v === 'done' ? '完成' : '失败'}</Tag>;
      },
    },
    { title: '平均耗时', dataIndex: 'avgDurationMs', width: 110, render: (v: number | null) => (v != null ? `${v} ms` : '—') },
    { title: '总 Token', dataIndex: 'totalTokens', width: 100, render: (v: number | null) => v ?? '—' },
    {
      title: '失败题数',
      dataIndex: 'results',
      width: 100,
      render: (v: AiEvalRun['results']) => {
        if (!v) return '—';
        const failed = v.filter((r) => r.error).length;
        return failed > 0 ? <Text type="danger">{failed}</Text> : 0;
      },
    },
    dateTimeColumn('运行时间', 'createdAt'),
    createOperationColumn<AiEvalRun>({
      width: 150,
      desktopInlineKeys: ['detail', 'delete'],
      actions: (record) => [
        { key: 'detail', label: '查看结果', onClick: () => setDetailRunId(record.id) },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !canManage,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该运行记录吗？',
              onOk: async () => {
                await deleteRunMutation.mutateAsync(record.id).then(() => Toast.success('已删除')).catch(() => {});
              },
            });
          },
        },
      ],
    }),
  ];

  const detailColumns = [
    { title: '#', width: 50, render: (_: unknown, __: unknown, idx: number) => idx + 1 },
    {
      title: '问题',
      dataIndex: 'question',
      width: 240,
      render: (v: string) => <Paragraph ellipsis={{ rows: 3, showTooltip: true }} style={{ fontSize: 13 }}>{v}</Paragraph>,
    },
    {
      title: '模型回答',
      dataIndex: 'answer',
      render: (v: string, record: { error?: string }) =>
        record.error
          ? <Text type="danger" style={{ fontSize: 13 }}>{record.error}</Text>
          : <Paragraph ellipsis={{ rows: 4, showTooltip: { opts: { style: { maxWidth: 560 } } } }} style={{ fontSize: 13 }}>{v}</Paragraph>,
    },
    {
      title: '期望要点',
      dataIndex: 'expected',
      width: 200,
      render: (v: string | undefined) => v ? <Paragraph ellipsis={{ rows: 3, showTooltip: true }} style={{ fontSize: 13 }}>{v}</Paragraph> : '—',
    },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (v: number) => `${v} ms` },
    { title: 'Token', width: 90, render: (_: unknown, r: { tokensInput: number; tokensOutput: number }) => r.tokensInput + r.tokensOutput },
  ];

  return (
    <div className="page-container page-tabs-page">
      <Tabs
        type="line"
        tabBarExtraContent={canManage ? <CreateButton onClick={modal.openCreate}>新建评测集</CreateButton> : undefined}
      >
        <TabPane tab="评测集" itemKey="sets">
          <div style={{ padding: '12px 0' }}>
            <ConfigurableTable
              bordered
              columnSettingsKey="ai-eval-sets"
              columns={setColumns}
              dataSource={setsQuery.data ?? []}
              rowKey="id"
              loading={setsQuery.isFetching}
              pagination={false}
              onRefresh={() => void setsQuery.refetch()}
              refreshLoading={setsQuery.isFetching}
            />
          </div>
        </TabPane>
        <TabPane tab="运行记录" itemKey="runs">
          <div style={{ padding: '12px 0' }}>
            <ConfigurableTable
              bordered
              columnSettingsKey="ai-eval-runs"
              columns={runColumns}
              dataSource={runsQuery.data ?? []}
              rowKey="id"
              loading={runsQuery.isFetching}
              pagination={false}
              onRefresh={() => void runsQuery.refetch()}
              refreshLoading={runsQuery.isFetching}
            />
          </div>
        </TabPane>
      </Tabs>

      {/* 评测集编辑 */}
      <Modal
        {...modal.modalProps}
        title={modal.isEdit ? '编辑评测集' : '新建评测集'}
        width={720}
      >
        <Form
          {...modal.formProps}
        >
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} maxLength={100} />
          <Form.Input field="description" label="描述" maxLength={300} />
          <Form.Slot label={{ text: '评测题目' }}>
            <ArrayField field="items">
              {({ add, arrayFields }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {arrayFields.map(({ field, key, remove }, idx) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Text type="tertiary" style={{ width: 24, lineHeight: '32px' }}>{idx + 1}.</Text>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Form.TextArea noLabel field={`${field}[question]`} rows={2} placeholder="评测问题" rules={[{ required: true, message: '必填' }]} />
                        <Form.Input noLabel field={`${field}[expected]`} placeholder="期望要点（可选，人工对照用）" />
                      </div>
                      <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={13} />} onClick={() => remove()} />
                    </div>
                  ))}
                  <Button theme="light" size="small" icon={<Plus size={13} />} onClick={() => add()} style={{ alignSelf: 'flex-start' }}>添加题目（最多 50 条）</Button>
                </div>
              )}
            </ArrayField>
          </Form.Slot>
        </Form>
      </Modal>

      {/* 运行评测 */}
      <Modal
        title={`运行评测：${runModalSet?.name ?? ''}`}
        visible={runModalSet !== null}
        onCancel={() => setRunModalSet(null)}
        onOk={handleRun}
        confirmLoading={runMutation.isPending}
        okText={'开始运行'}
        closeOnEsc
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Text type="tertiary" style={{ fontSize: 13 }}>
            共 {runModalSet?.items.length ?? 0} 题，将通过任务中心逐题调用所选模型（可在顶栏任务托盘查看进度）。
            对同一评测集使用不同模型分别运行，即可在运行记录中对比回归效果。
          </Text>
          <Form labelPosition="left" labelWidth={60} style={{ width: '100%' }}>
            <Form.Select
              field="model"
              label="模型"
              style={{ width: '100%' }}
              optionList={modelOptions}
              initValue=""
              onChange={(v) => setRunModelValue(String(v ?? ''))}
            />
          </Form>
        </Space>
      </Modal>

      {/* 运行结果详情 */}
      <SideSheet
        title={detailQuery.data ? `评测结果 — ${detailQuery.data.setName ?? ''}（${detailQuery.data.model}）` : '评测结果'}
        visible={detailRunId !== null}
        onCancel={() => setDetailRunId(null)}
        width={900}
      >
        {detailQuery.data && (
          <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
            <Space>
              <Tag color={detailQuery.data.status === 'done' ? 'green' : detailQuery.data.status === 'failed' ? 'red' : 'blue'}>
                {detailQuery.data.status === 'done' ? '完成' : detailQuery.data.status === 'failed' ? '失败' : '运行中'}
              </Tag>
              {detailQuery.data.avgDurationMs != null && <Tag color="white">平均 {detailQuery.data.avgDurationMs} ms</Tag>}
              {detailQuery.data.totalTokens != null && <Tag color="white">共 {detailQuery.data.totalTokens} tokens</Tag>}
              <Tag color="white">{detailQuery.data.createdAt}</Tag>
            </Space>
            <Table
              columns={detailColumns}
              dataSource={detailQuery.data.results ?? []}
              rowKey={(r?: { question?: string }) => r?.question ?? ''}
              pagination={false}
              size="small"
              bordered
            />
          </Space>
        )}
      </SideSheet>
    </div>
  );
}
