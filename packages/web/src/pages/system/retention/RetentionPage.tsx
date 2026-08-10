import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  InputNumber,
  Switch,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { Archive, RotateCcw } from 'lucide-react';
import type { RetentionPolicy } from '@zenith/shared/ops';
import { usePermission } from '@/hooks/usePermission';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import {
  useRetentionPolicies,
  useRetentionPreview,
  useRunRetentionPolicy,
  useUpdateRetentionPolicy,
} from '@/hooks/queries/retention';

const { Title, Text } = Typography;

interface EditForm {
  enabled: boolean;
  retentionDays: number;
  batchSize: number;
}

export default function RetentionPage() {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission('system:retention:edit');
  const canRun = hasPermission('system:retention:run');

  const { data: policies = [], isLoading } = useRetentionPolicies();
  const updateMutation = useUpdateRetentionPolicy();
  const previewMutation = useRetentionPreview();
  const runMutation = useRunRetentionPolicy();

  const [editing, setEditing] = useState<RetentionPolicy | null>(null);
  const [form, setForm] = useState<EditForm>({ enabled: true, retentionDays: 180, batchSize: 5000 });
  const [pending, setPending] = useState<Record<string, number>>({});

  const disabledCount = useMemo(
    () => policies.filter((item) => !item.enabled || item.retentionDays === 0).length,
    [policies],
  );

  const openEdit = (policy: RetentionPolicy) => {
    setEditing(policy);
    setForm({
      enabled: policy.enabled,
      retentionDays: policy.retentionDays,
      batchSize: policy.batchSize,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    await updateMutation.mutateAsync({ key: editing.key, input: form });
    Toast.success('保留策略已更新');
    setEditing(null);
  };

  const handlePreview = async (policy: RetentionPolicy) => {
    const result = await previewMutation.mutateAsync(policy.key);
    setPending((prev) => ({ ...prev, [policy.key]: result.pending }));
    Toast.info(
      result.cutoff
        ? `「${policy.title}」当前有 ${result.pending} 行早于 ${result.cutoff}`
        : `「${policy.title}」保留天数为 0，不会清理`,
    );
  };
  const handleRun = async (policy: RetentionPolicy) => {
    const result = await runMutation.mutateAsync(policy.key);
    setPending((prev) => ({ ...prev, [policy.key]: 0 }));
    Toast.success(`「${policy.title}」已清理 ${result.deleted} 行`);
  };

  return (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Title heading={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Archive size={18} />
          数据保留策略
        </Title>
        <Text type="tertiary" style={{ display: 'block', marginTop: 8 }}>
          全库日志与流水表的保留口径集中在此配置，由「系统调度」中的
          <Text strong> 数据保留清理（data-retention）</Text> 任务每天 03:00 统一执行。
          保留天数设为 0 表示永久保留，该策略会被跳过。
          共 {policies.length} 条策略，其中 {disabledCount} 条不参与清理。
        </Text>
      </Card>

      <ConfigurableTable<RetentionPolicy & { _rowId: string }>
        rowKey="key"
        loading={isLoading}
        dataSource={policies.map((item) => ({ ...item, _rowId: item.key }))}
        pagination={false}
        columns={[
          { key: 'module', title: '模块', dataIndex: 'module', width: 130 },
          {
            key: 'title',
            title: '数据表',
            dataIndex: 'title',
            width: 200,
            render: (_: unknown, row: RetentionPolicy) => (
              <div>
                <div>{row.title}</div>
                <Text type="tertiary" size="small">{row.tableName}</Text>
              </div>
            ),
          },
          {
            key: 'retentionDays',
            title: '保留天数',
            dataIndex: 'retentionDays',
            width: 120,
            render: (days: number) => (days > 0
              ? <Tag color="blue">{days} 天</Tag>
              : <Tag color="grey">永久保留</Tag>),
          },
          {
            key: 'enabled',
            title: '状态',
            dataIndex: 'enabled',
            width: 100,
            render: (enabled: boolean) => (enabled
              ? <Tag color="green">启用</Tag>
              : <Tag color="grey">停用</Tag>),
          },
          {
            key: 'scope',
            title: '清理方式',
            width: 160,
            render: (_: unknown, row: RetentionPolicy) => (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {row.perTenant && <Tag size="small" color="violet">按租户</Tag>}
                {row.mode === 'ageAndCap' && (
                  <Tag size="small" color="orange">另限 {row.capLimit} 条/组</Tag>
                )}
                {row.mode === 'age' && !row.perTenant && (
                  <Tag size="small" color="white">按时间</Tag>
                )}
              </div>
            ),
          },
          {
            key: 'lastRunAt',
            title: '上次执行',
            dataIndex: 'lastRunAt',
            width: 180,
            render: (at: string | null, row: RetentionPolicy) => (at
              ? <div><div>{at}</div><Text type="tertiary" size="small">清理 {row.lastDeleted} 行</Text></div>
              : <Text type="tertiary">从未执行</Text>),
          },
          {
            key: 'pending',
            title: '待清理',
            width: 110,
            render: (_: unknown, row: RetentionPolicy) => (pending[row.key] === undefined
              ? <Text type="tertiary">未查看</Text>
              : <Text strong={pending[row.key] > 0}>{pending[row.key]} 行</Text>),
          },
          {
            key: 'description',
            title: '说明',
            dataIndex: 'description',
            ellipsis: true,
          },
          createOperationColumn<RetentionPolicy & { _rowId: string }>({
            width: 150,
            desktopInlineKeys: ['preview'],
            actions: (row) => [
              { key: 'preview', label: '查看待清理量', onClick: () => handlePreview(row) },
              { key: 'edit', label: '编辑策略', hidden: !canEdit, onClick: () => openEdit(row) },
              {
                key: 'run',
                label: '立即清理',
                danger: true,
                hidden: !canRun || row.retentionDays === 0,
                onClick: () => handleRun(row),
              },
            ],
          }),
        ]}
      />

      <AppModal
        visible={editing !== null}
        title={editing ? `编辑「${editing.title}」保留策略` : ''}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateMutation.isPending}
        onOk={handleSave}
        onCancel={() => setEditing(null)}
        width={480}
      >
        {editing && (
          <Form labelPosition="left" labelWidth={110}>
            <Form.Slot label="启用">
              <Switch
                checked={form.enabled}
                onChange={(v) => setForm((prev) => ({ ...prev, enabled: v }))}
              />
            </Form.Slot>
            <Form.Slot label="保留天数">
              <InputNumber
                min={0}
                max={3650}
                value={form.retentionDays}
                onChange={(v) => setForm((prev) => ({ ...prev, retentionDays: Number(v) || 0 }))}
                style={{ width: '100%' }}
                suffix="天"
              />
              <Text type="tertiary" size="small">
                0 表示永久保留；默认 {editing.defaultRetentionDays} 天
              </Text>
            </Form.Slot>
            <Form.Slot label="单批行数">
              <InputNumber
                min={100}
                max={50_000}
                step={1000}
                value={form.batchSize}
                onChange={(v) => setForm((prev) => ({ ...prev, batchSize: Number(v) || 5000 }))}
                style={{ width: '100%' }}
              />
              <Text type="tertiary" size="small">分批删除的单批上限，避免长事务锁表</Text>
            </Form.Slot>
            <Form.Slot label="">
              <Button
                icon={<RotateCcw size={14} />}
                onClick={() => setForm((prev) => ({ ...prev, retentionDays: editing.defaultRetentionDays }))}
              >
                恢复默认天数
              </Button>
            </Form.Slot>
          </Form>
        )}
      </AppModal>
    </div>
  );
}
