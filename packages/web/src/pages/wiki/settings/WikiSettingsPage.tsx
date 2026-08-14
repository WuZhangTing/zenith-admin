import { useEffect, useState } from 'react';
import { Banner, Button, Divider, InputNumber, Select, Spin, Switch, Toast, Typography } from '@douyinfe/semi-ui';
import type { WikiSpaceVisibility } from '@zenith/shared/wiki';
import { WIKI_SPACE_VISIBILITY_OPTIONS } from '@zenith/shared/wiki';
import { usePermission } from '@/hooks/usePermission';
import { useAvailableKnowledgeBases } from '@/hooks/queries/ai-extras';
import { useUpdateWikiSettings, useWikiSettings } from '@/hooks/queries/wiki-stats';

const { Text, Title } = Typography;

interface SettingRowProps {
  title: string;
  description: string;
  control: React.ReactNode;
}

function SettingRow({ title, description, control }: SettingRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0' }}>
      <div style={{ minWidth: 0 }}>
        <Title heading={6} style={{ margin: 0 }}>{title}</Title>
        <Text type="tertiary" size="small">{description}</Text>
      </div>
      {control}
    </div>
  );
}

export default function WikiSettingsPage() {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission('wiki:setting:edit');

  const settingsQuery = useWikiSettings();
  const updateMutation = useUpdateWikiSettings();

  const [requireApproval, setRequireApproval] = useState(true);
  const [defaultVisibility, setDefaultVisibility] = useState<WikiSpaceVisibility>('public');
  const [aiSyncEnabled, setAiSyncEnabled] = useState(false);
  const [aiSyncKbId, setAiSyncKbId] = useState<number | null>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [recycleRetentionDays, setRecycleRetentionDays] = useState(0);
  const [pendingRemindHours, setPendingRemindHours] = useState(48);

  const kbQuery = useAvailableKnowledgeBases(aiSyncEnabled);

  // 设置到达后播种表单交互态
  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setRequireApproval(s.requireApproval);
    setDefaultVisibility(s.defaultVisibility);
    setAiSyncEnabled(s.aiSyncEnabled);
    setAiSyncKbId(s.aiSyncKbId);
    setCommentsEnabled(s.commentsEnabled);
    setRecycleRetentionDays(s.recycleRetentionDays);
    setPendingRemindHours(s.pendingRemindHours);
  }, [settingsQuery.data]);

  function handleSave() {
    if (aiSyncEnabled && !aiSyncKbId) {
      Toast.warning('开启 AI 同步时必须选择目标知识库');
      return;
    }
    updateMutation.mutate(
      { requireApproval, defaultVisibility, aiSyncEnabled, aiSyncKbId, commentsEnabled, recycleRetentionDays, pendingRemindHours },
      { onSuccess: () => Toast.success('设置已保存') },
    );
  }

  return (
    <div className="page-container">
      <Spin spinning={settingsQuery.isPending}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 8 }}>
            <Title heading={5} style={{ margin: 0 }}>知识库设置</Title>
            <Text type="tertiary">发布、协作、内容治理与知识同步策略</Text>
          </div>

          <SettingRow
            title="发布需审核"
            description="开启后文档提交发布需经审核人通过；关闭则提交即发布"
            control={(
              <Switch checked={requireApproval} disabled={!canEdit} onChange={setRequireApproval} />
            )}
          />
          <Divider margin={0} />
          <SettingRow
            title="空间默认可见性"
            description="新建知识空间时的默认可见范围"
            control={(
              <Select
                style={{ width: 160 }}
                value={defaultVisibility}
                disabled={!canEdit}
                onChange={(v) => setDefaultVisibility(v as WikiSpaceVisibility)}
                optionList={WIKI_SPACE_VISIBILITY_OPTIONS}
              />
            )}
          />
          <Divider margin={0} />
          <SettingRow
            title="同步 AI 知识库"
            description="开启后，已开启同步的空间中发布的文档会自动进入所选 AI 知识库，可在智能对话中引用"
            control={(
              <Switch checked={aiSyncEnabled} disabled={!canEdit} onChange={setAiSyncEnabled} />
            )}
          />
          {aiSyncEnabled ? (
            <>
              <Divider margin={0} />
              <SettingRow
                title="同步目标知识库"
                description="文档发布后写入的 AI 知识库"
                control={(
                  <Select
                    style={{ width: 220 }}
                    placeholder="选择 AI 知识库"
                    value={aiSyncKbId ?? undefined}
                    disabled={!canEdit}
                    loading={kbQuery.isFetching}
                    onChange={(v) => setAiSyncKbId(v === undefined ? null : Number(v))}
                    optionList={(kbQuery.data ?? []).map((kb) => ({ value: kb.id, label: kb.name }))}
                    showClear
                  />
                )}
              />
            </>
          ) : null}
          {aiSyncEnabled && (kbQuery.data?.length ?? 0) === 0 && !kbQuery.isFetching ? (
            <Banner
              type="info"
              description="还没有可用的 AI 知识库，请先到 智能助手 → 知识库 创建一个"
            />
          ) : null}
          <Divider margin={0} />
          <SettingRow
            title="允许评论"
            description="关闭后所有文档暂停新评论，已有评论保留展示"
            control={(
              <Switch checked={commentsEnabled} disabled={!canEdit} onChange={setCommentsEnabled} />
            )}
          />
          <Divider margin={0} />
          <SettingRow
            title="回收站保留天数"
            description="超期的已删除文档由每日治理任务彻底清理；0 表示永久保留"
            control={(
              <InputNumber
                style={{ width: 140 }}
                min={0}
                max={3650}
                disabled={!canEdit}
                value={recycleRetentionDays}
                onChange={(v) => setRecycleRetentionDays(Number(v) || 0)}
                suffix="天"
              />
            )}
          />
          <Divider margin={0} />
          <SettingRow
            title="审核积压提醒时限"
            description="待审核文档超过该时长未处理时进入治理「审核积压」清单"
            control={(
              <InputNumber
                style={{ width: 140 }}
                min={1}
                max={720}
                disabled={!canEdit}
                value={pendingRemindHours}
                onChange={(v) => setPendingRemindHours(Number(v) || 48)}
                suffix="小时"
              />
            )}
          />

          {canEdit ? (
            <div style={{ marginTop: 24 }}>
              <Button theme="solid" loading={updateMutation.isPending} onClick={handleSave}>保存设置</Button>
            </div>
          ) : null}
        </div>
      </Spin>
    </div>
  );
}
