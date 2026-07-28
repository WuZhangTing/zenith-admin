import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DatePicker,
  Input,
  Modal,
  Progress,
  Select,
  SideSheet,
  Spin,
  TabPane,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Plus, RotateCcw, Search } from 'lucide-react';
import {
  CMS_INTERACTION_KIND_LABELS,
  CMS_INTERACTION_PARTICIPANT_SCOPE_LABELS,
  CMS_INTERACTION_QUESTION_TYPE_LABELS,
  CMS_INTERACTION_REPEAT_POLICY_LABELS,
  CMS_INTERACTION_STATUS_LABELS,
  type CmsInteraction,
  type CmsInteractionKind,
  type CmsInteractionResponse,
  type CmsInteractionStatus,
} from '@zenith/shared';
import ConfigurableTable from '@/components/ConfigurableTable';
import ExportButton from '@/components/ExportButton';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import {
  cmsInteractionKeys,
  useBatchCmsInteractionStatus,
  useAllCmsSites,
  useCmsInteractionList,
  useCmsInteractionResponseList,
  useCmsInteractionStats,
  useDeleteCmsInteraction,
  useSetCmsInteractionStatus,
} from '@/hooks/queries/cms';
import { formatDateTimeForApi } from '@/utils/date';
import { renderEllipsis } from '@/utils/table-columns';
import { CmsSiteSelect, cmsPreviewUrl } from './CmsSiteSelect';
import InteractionEditorModal from './interaction/InteractionEditorModal';

interface ListSearch {
  keyword: string;
  kind?: CmsInteractionKind;
  status?: CmsInteractionStatus;
}

const initialSearch: ListSearch = { keyword: '' };
const STATUS_COLORS: Record<CmsInteractionStatus, 'grey' | 'green' | 'orange'> = {
  draft: 'grey',
  published: 'green',
  closed: 'orange',
};

function ResultsSheet({ interaction, onClose }: Readonly<{
  interaction: CmsInteraction | null;
  onClose: () => void;
}>) {
  const query = useCmsInteractionStats(interaction?.id, !!interaction);
  return (
    <SideSheet title={interaction ? `结果统计：${interaction.title}` : '结果统计'} visible={!!interaction} onCancel={onClose} width={540}>
      <Spin spinning={query.isFetching}>
        {query.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Typography.Text type="tertiary">共收集 {query.data.responseCount} 份答卷</Typography.Text>
            {query.data.questions.map((question, index) => (
              <section key={question.id}>
                <Typography.Title heading={6}>
                  {index + 1}. {question.label}
                  <Tag size="small" style={{ marginLeft: 8 }}>{CMS_INTERACTION_QUESTION_TYPE_LABELS[question.type]}</Tag>
                </Typography.Title>
                {question.type === 'text' ? (
                  question.texts.length > 0
                    ? question.texts.map((text, textIndex) => (
                        <div key={`${question.id}-${textIndex}`} style={{ padding: 8, marginTop: 6, background: 'var(--semi-color-fill-0)', borderRadius: 'var(--semi-border-radius-medium)' }}>{text}</div>
                      ))
                    : <Typography.Text type="tertiary">暂无文本回答</Typography.Text>
                ) : question.options.map((option) => (
                  <div key={option.id} style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{option.label}</span>
                      <span>{option.count} · {option.percent}%</span>
                    </div>
                    <Progress percent={option.percent} showInfo={false} />
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : null}
      </Spin>
    </SideSheet>
  );
}

export default function SurveysPage() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const [siteId, setSiteId] = useState<number | undefined>();
  const [draft, setDraft] = useState<ListSearch>(initialSearch);
  const [submitted, setSubmitted] = useState<ListSearch>(initialSearch);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CmsInteraction | null>(null);
  const [resultsTarget, setResultsTarget] = useState<CmsInteraction | null>(null);
  const [responseDetail, setResponseDetail] = useState<CmsInteractionResponse | null>(null);
  const [responsePage, setResponsePage] = useState(1);
  const [responseTimeRange, setResponseTimeRange] = useState<[Date, Date] | undefined>();

  const listQuery = useCmsInteractionList({
    page,
    pageSize,
    siteId: siteId ?? 0,
    keyword: submitted.keyword || undefined,
    kind: submitted.kind,
    status: submitted.status,
  }, !!siteId);
  const sitesQuery = useAllCmsSites();
  const currentSite = sitesQuery.data?.find((site) => site.id === siteId);
  const deleteMutation = useDeleteCmsInteraction();
  const statusMutation = useSetCmsInteractionStatus();
  const batchMutation = useBatchCmsInteractionStatus();
  const responseQuery = useCmsInteractionResponseList({
    page: responsePage,
    pageSize,
    siteId: siteId ?? 0,
    kind: submitted.kind,
    startTime: responseTimeRange ? formatDateTimeForApi(responseTimeRange[0]) : undefined,
    endTime: responseTimeRange ? formatDateTimeForApi(responseTimeRange[1]) : undefined,
  }, !!siteId);

  const canManage = hasPermission('cms:interaction:manage');
  const canBatch = hasPermission('cms:interaction:batch');

  const handleSearch = () => {
    setPage(1);
    setResponsePage(1);
    setSubmitted(draft);
    void queryClient.invalidateQueries({ queryKey: cmsInteractionKeys.lists });
  };
  const handleReset = () => {
    setPage(1);
    setResponsePage(1);
    setDraft(initialSearch);
    setSubmitted(initialSearch);
    setResponseTimeRange(undefined);
    void queryClient.invalidateQueries({ queryKey: cmsInteractionKeys.lists });
  };

  const closeEditor = () => {
    setModalVisible(false);
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const changeStatus = async (record: CmsInteraction, status: CmsInteractionStatus) => {
    await statusMutation.mutateAsync({ id: record.id, status });
    Toast.success(status === 'published' ? '已发布' : status === 'closed' ? '已关闭' : '已转为草稿');
  };

  const submitBatch = (status: 'published' | 'closed') => {
    Modal.confirm({
      title: status === 'published' ? '批量发布互动问卷？' : '批量关闭互动问卷？',
      content: '操作将提交到任务中心，可在全局任务托盘查看进度、取消或重试。',
      onOk: async () => {
        await batchMutation.mutateAsync({ ids: selectedIds, status });
        setSelectedIds([]);
        Toast.success('批量任务已提交');
      },
    });
  };

  const listColumns: ColumnProps<CmsInteraction>[] = [
    { title: '标题', dataIndex: 'title', width: 240, render: renderEllipsis },
    {
      title: '类型', dataIndex: 'kind', width: 90,
      render: (value: CmsInteractionKind) => <Tag size="small">{CMS_INTERACTION_KIND_LABELS[value]}</Tag>,
    },
    { title: '标识', dataIndex: 'code', width: 150 },
    { title: '参与范围', dataIndex: 'participantScope', width: 120, render: (value: CmsInteraction['participantScope']) => CMS_INTERACTION_PARTICIPANT_SCOPE_LABELS[value] },
    { title: '重复策略', dataIndex: 'repeatPolicy', width: 140, render: (value: CmsInteraction['repeatPolicy']) => CMS_INTERACTION_REPEAT_POLICY_LABELS[value] },
    { title: '答卷数', dataIndex: 'responseCount', width: 90, align: 'right' },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (value: CmsInteractionStatus) => <Tag size="small" color={STATUS_COLORS[value]}>{CMS_INTERACTION_STATUS_LABELS[value]}</Tag>,
    },
    createOperationColumn<CmsInteraction>({
      width: 260,
      desktopInlineKeys: ['results', 'publish', 'close', 'edit'],
      actions: (record) => [
        { key: 'results', label: '结果', onClick: () => setResultsTarget(record) },
        {
          key: 'visit',
          label: '访问',
          hidden: record.status === 'draft' || !currentSite,
          onClick: () => {
            if (currentSite) window.open(cmsPreviewUrl(currentSite.code, `interaction/${record.code}/`), '_blank');
          },
        },
        {
          key: 'publish', label: '发布',
          hidden: !canManage || record.status === 'published',
          onClick: () => { void changeStatus(record, 'published'); },
        },
        {
          key: 'close', label: '关闭',
          hidden: !canManage || record.status !== 'published',
          onClick: () => { void changeStatus(record, 'closed'); },
        },
        {
          key: 'edit', label: '设计', hidden: !canManage,
          onClick: () => { setEditing(record); setModalVisible(true); },
        },
        {
          key: 'delete', label: '删除', danger: true,
          hidden: !canManage,
          onClick: () => {
            Modal.confirm({
              title: `删除「${record.title}」？`,
              content: `将级联删除 ${record.responseCount} 份答卷，无法恢复。`,
              okButtonProps: { type: 'danger', theme: 'solid' },
              onOk: async () => {
                await deleteMutation.mutateAsync(record.id);
                Toast.success('删除成功');
              },
            });
          },
        },
      ],
    }),
  ];

  const responseColumns: ColumnProps<CmsInteractionResponse>[] = [
    { title: '互动问卷', dataIndex: 'interactionTitle', width: 240, render: renderEllipsis },
    {
      title: '类型', dataIndex: 'kind', width: 90,
      render: (value: CmsInteractionKind | undefined) => value ? CMS_INTERACTION_KIND_LABELS[value] : '-',
    },
    { title: '参与者', dataIndex: 'memberDisplay', width: 140 },
    { title: '提交时间', dataIndex: 'createdAt', width: 180 },
    createOperationColumn<CmsInteractionResponse>({
      width: 90,
      desktopInlineKeys: ['view'],
      actions: (record) => [{ key: 'view', label: '查看', onClick: () => setResponseDetail(record) }],
    }),
  ];

  const listSearch = (
    <>
      <CmsSiteSelect value={siteId} onChange={(value) => { setSiteId(value); setPage(1); setResponsePage(1); }} />
      <Input prefix={<Search size={14} />} placeholder="标题/标识" showClear value={draft.keyword}
        onChange={(value) => setDraft((current) => ({ ...current, keyword: value }))} onEnterPress={handleSearch} style={{ width: 200 }} />
      <Select placeholder="全部类型" showClear value={draft.kind} style={{ width: 130 }}
        optionList={Object.entries(CMS_INTERACTION_KIND_LABELS).map(([value, label]) => ({ value, label }))}
        onChange={(value) => setDraft((current) => ({ ...current, kind: value as CmsInteractionKind | undefined }))} />
      <Select placeholder="全部状态" showClear value={draft.status} style={{ width: 130 }}
        optionList={Object.entries(CMS_INTERACTION_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        onChange={(value) => setDraft((current) => ({ ...current, status: value as CmsInteractionStatus | undefined }))} />
      <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>查询</Button>
      <Button type="tertiary" icon={<RotateCcw size={14} />} onClick={handleReset}>重置</Button>
    </>
  );

  const responseExportQuery = {
    siteId,
    kind: submitted.kind,
    startTime: responseTimeRange ? formatDateTimeForApi(responseTimeRange[0]) : undefined,
    endTime: responseTimeRange ? formatDateTimeForApi(responseTimeRange[1]) : undefined,
  };

  return (
    <div className="page-container page-tabs-page">
      <Tabs type="line" lazyRender keepDOM={false}>
        <TabPane tab="互动管理" itemKey="interactions">
          <SearchToolbar
            primary={listSearch}
            actions={canManage && siteId ? <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增</Button> : null}
            mobilePrimary={(
              <>
                <CmsSiteSelect value={siteId} onChange={setSiteId} />
                <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>查询</Button>
                {canManage ? <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新增</Button> : null}
              </>
            )}
            mobileFilters={listSearch}
            filterTitle="互动问卷筛选"
            onFilterApply={handleSearch}
            onFilterReset={handleReset}
          />
          {selectedIds.length > 0 && canBatch ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Button onClick={() => submitBatch('published')}>批量发布（{selectedIds.length}）</Button>
              <Button type="warning" onClick={() => submitBatch('closed')}>批量关闭</Button>
            </div>
          ) : null}
          <ConfigurableTable
            bordered
            columns={listColumns}
            dataSource={listQuery.data?.list ?? []}
            loading={listQuery.isFetching}
            rowKey="id"
            empty={siteId ? '暂无互动问卷' : '请先选择站点'}
            scroll={{ x: 1400 }}
            rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
            onRefresh={() => void listQuery.refetch()}
            refreshLoading={listQuery.isFetching}
            pagination={buildPagination(listQuery.data?.total ?? 0)}
          />
        </TabPane>
        <TabPane tab="答卷明细" itemKey="responses">
          <SearchToolbar
            primary={(
              <>
                <CmsSiteSelect value={siteId} onChange={setSiteId} />
                <Select placeholder="全部类型" showClear value={draft.kind} style={{ width: 140 }}
                  optionList={Object.entries(CMS_INTERACTION_KIND_LABELS).map(([value, label]) => ({ value, label }))}
                  onChange={(value) => setDraft((current) => ({ ...current, kind: value as CmsInteractionKind | undefined }))} />
                <DatePicker type="dateTimeRange" value={responseTimeRange} style={{ width: 330 }}
                  placeholder={['提交开始时间', '提交结束时间']}
                  onChange={(value) => setResponseTimeRange(value as [Date, Date] | undefined)} />
                <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>查询</Button>
                <Button type="tertiary" icon={<RotateCcw size={14} />} onClick={handleReset}>重置</Button>
              </>
            )}
            actions={siteId && hasPermission('cms:interaction:export')
              ? <ExportButton entity="cms.interaction-responses" query={responseExportQuery} />
              : null}
          />
          <ConfigurableTable
            bordered
            columns={responseColumns}
            dataSource={responseQuery.data?.list ?? []}
            loading={responseQuery.isFetching}
            rowKey="id"
            empty={siteId ? '暂无答卷' : '请先选择站点'}
            onRefresh={() => void responseQuery.refetch()}
            refreshLoading={responseQuery.isFetching}
            pagination={{
              total: responseQuery.data?.total ?? 0,
              pageSize,
              currentPage: responsePage,
              onPageChange: setResponsePage,
            }}
          />
        </TabPane>
      </Tabs>

      <InteractionEditorModal
        visible={modalVisible}
        siteId={siteId}
        editing={editing}
        onCancel={closeEditor}
        onSaved={closeEditor}
      />

      <ResultsSheet interaction={resultsTarget} onClose={() => setResultsTarget(null)} />
      <SideSheet title="答卷详情" visible={!!responseDetail} onCancel={() => setResponseDetail(null)} width={520}>
        {responseDetail ? (
          <dl style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <dt>互动问卷</dt><dd>{responseDetail.interactionTitle}</dd>
            <dt>参与者</dt><dd>{responseDetail.memberDisplay}</dd>
            <dt>提交时间</dt><dd>{responseDetail.createdAt}</dd>
            <dt>答案</dt><dd><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(responseDetail.answers, null, 2)}</pre></dd>
          </dl>
        ) : null}
      </SideSheet>
    </div>
  );
}
