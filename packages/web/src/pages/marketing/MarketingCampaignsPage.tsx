import { useState } from 'react';
import { Col, Form, Modal, Row, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { DateRangeFilter, KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { createdAtColumn, EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { confirmDelete } from '@/utils/confirm';
import { formatDateTimeForApi, formatDateTimeRangeForApi } from '@/utils/date';
import {
  marketingCampaignKeys, useDeleteMarketingCampaigns, useEndMarketingCampaign,
  useMarketingCampaignDetail, useMarketingCampaignList, usePublishMarketingCampaign, useSaveMarketingCampaign,
} from '@/hooks/queries/marketing-campaigns';
import {
  MARKETING_CAMPAIGN_STATUS_LABELS, MARKETING_CAMPAIGN_STATUS_OPTIONS,
} from '@zenith/shared/marketing';
import type { MarketingCampaign } from '@zenith/shared/marketing';
import MarketingPrizesDrawer from './MarketingPrizesDrawer';
import MarketingRecordsDrawer from './MarketingRecordsDrawer';

const { Text } = Typography;

interface SearchParams {
  keyword: string;
  status: string;
  timeRange: [Date, Date] | null;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '', timeRange: null };

const STATUS_COLORS: Record<MarketingCampaign['status'], string> = {
  draft: 'grey',
  published: 'green',
  ended: 'red',
};

export default function MarketingCampaignsPage() {
  const { hasPermission } = usePermission();
  const [prizesCampaign, setPrizesCampaign] = useState<MarketingCampaign | null>(null);
  const [recordsCampaign, setRecordsCampaign] = useState<MarketingCampaign | null>(null);

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: marketingCampaignKeys.lists });

  const listQuery = useMarketingCampaignList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const modal = useEditModal<MarketingCampaign, Record<string, unknown>, Partial<MarketingCampaign>>({
    entityName: '营销活动',
    save: useSaveMarketingCampaign(),
    useDetail: useMarketingCampaignDetail,
    defaults: { perMemberLimit: 1 },
    toValues: (r) => ({
      name: r.name,
      startAt: r.startAt,
      endAt: r.endAt,
      perMemberLimit: r.perMemberLimit,
      dailyPerMemberLimit: r.dailyPerMemberLimit ?? undefined,
      landingUrl: r.landingUrl ?? '',
      description: r.description ?? '',
    }),
    beforeSave: (values) => ({
      name: values.name as string,
      startAt: values.startAt ? formatDateTimeForApi(values.startAt as Date | string) : '',
      endAt: values.endAt ? formatDateTimeForApi(values.endAt as Date | string) : '',
      perMemberLimit: typeof values.perMemberLimit === 'number' ? values.perMemberLimit : 1,
      dailyPerMemberLimit: typeof values.dailyPerMemberLimit === 'number' ? values.dailyPerMemberLimit : null,
      landingUrl: (values.landingUrl as string) || null,
      description: (values.description as string) || null,
    }),
    labelWidth: 110,
  });

  const deleteMutation = useDeleteMarketingCampaigns();
  const publishMutation = usePublishMarketingCampaign();
  const endMutation = useEndMarketingCampaign();

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  function handlePublish(record: MarketingCampaign) {
    Modal.confirm({
      title: '确认发布',
      content: `发布后活动「${record.name}」在时间窗内即可参与${record.landingUrl ? '，并自动生成分享短链' : ''}，确认发布？`,
      onOk: async () => {
        await publishMutation.mutateAsync(record.id);
        Toast.success('发布成功');
      },
    });
  }

  function handleEnd(record: MarketingCampaign) {
    Modal.confirm({
      title: '确认结束',
      content: `结束后会员将无法继续参与「${record.name}」，确认结束？`,
      okButtonProps: { type: 'warning', theme: 'solid' },
      onOk: async () => {
        await endMutation.mutateAsync(record.id);
        Toast.success('活动已结束');
      },
    });
  }

  const columns: ColumnProps<MarketingCampaign>[] = [
    { title: '活动名称', dataIndex: 'name', width: 200 },
    {
      title: '活动时间', width: 200,
      render: (_: unknown, r: MarketingCampaign) => (
        <div>
          <div>{r.startAt}</div>
          <Text type="tertiary" size="small">至 {r.endAt}</Text>
        </div>
      ),
    },
    {
      title: '每人次数', width: 110, align: 'right',
      render: (_: unknown, r: MarketingCampaign) => `${r.perMemberLimit} 次${r.dailyPerMemberLimit ? ` / 日限 ${r.dailyPerMemberLimit}` : ''}`,
    },
    { title: '参与', dataIndex: 'participationCount', width: 80, align: 'right' },
    { title: '中奖', dataIndex: 'awardCount', width: 80, align: 'right' },
    {
      title: '分享短链', width: 150,
      render: (_: unknown, r: MarketingCampaign) => r.shortUrl
        ? <Text copyable={{ content: r.shortUrl }} style={{ whiteSpace: 'nowrap' }}>{r.shortUrl.replace(/^https?:\/\//, '')}</Text>
        : (r.landingUrl ? <Text type="tertiary">发布后生成</Text> : EMPTY_PLACEHOLDER),
    },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (v: MarketingCampaign['status']) => (
        <Tag color={STATUS_COLORS[v]} size="small">{MARKETING_CAMPAIGN_STATUS_LABELS[v]}</Tag>
      ),
    },
    createOperationColumn<MarketingCampaign>({
      width: 200,
      desktopInlineKeys: ['prizes', 'records', 'publish', 'end'],
      actions: (record) => [
        ...(hasPermission('marketing:campaign:list') ? [{
          key: 'prizes', label: '奖品', onClick: () => setPrizesCampaign(record),
        }] : []),
        ...(hasPermission('marketing:record:list') ? [{
          key: 'records', label: '记录', onClick: () => setRecordsCampaign(record),
        }] : []),
        ...(hasPermission('marketing:campaign:publish') && record.status === 'draft' ? [{
          key: 'publish', label: '发布', onClick: () => handlePublish(record),
        }] : []),
        ...(hasPermission('marketing:campaign:publish') && record.status === 'published' ? [{
          key: 'end', label: '结束', onClick: () => handleEnd(record),
        }] : []),
        ...(hasPermission('marketing:campaign:update') && record.status !== 'ended' ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('marketing:campaign:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          disabledReason: record.status === 'published' ? '进行中不可删' : undefined,
          onClick: () => {
            confirmDelete({
              title: `确定要删除活动「${record.name}」吗？`,
              content: '删除后奖品与参与记录一并清除，不可恢复',
              onOk: () => handleDelete(record.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索活动名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={MARKETING_CAMPAIGN_STATUS_OPTIONS}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter
      value={draftParams.timeRange}
      onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))}
    />
  );

  const renderCreateButton = () => hasPermission('marketing:campaign:create')
    ? <CreateButton onClick={modal.openCreate} /> : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          {renderStatusFilter()}
          {renderTimeRangeFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderCreateButton()}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          {renderCreateButton()}
        </>}
        mobileFilters={<>
          {renderStatusFilter()}
          {renderTimeRangeFilter()}
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
        empty="暂无营销活动"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      {/* 新增 / 编辑 */}
      <AppModal {...modal.modalProps} width={660}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            <Form.Input field="name" label="活动名称" placeholder="如：新春抽奖 · 天天有礼"
              rules={[{ required: true, message: '活动名称不能为空' }]} />
            <Row gutter={16}>
              <Col span={12}>
                <Form.DatePicker field="startAt" label="开始时间" type="dateTime" style={{ width: '100%' }}
                  rules={[{ required: true, message: '请选择开始时间' }]} />
              </Col>
              <Col span={12}>
                <Form.DatePicker field="endAt" label="结束时间" type="dateTime" style={{ width: '100%' }}
                  rules={[{ required: true, message: '请选择结束时间' }]} />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.InputNumber field="perMemberLimit" label="每人总次数" style={{ width: '100%' }} min={1}
                  rules={[{ required: true, message: '请填写每人参与次数上限' }]} />
              </Col>
              <Col span={12}>
                <Form.InputNumber field="dailyPerMemberLimit" label="每人每日次数" style={{ width: '100%' }}
                  min={1} placeholder="留空不限" showClear />
              </Col>
            </Row>
            <Form.Input
              field="landingUrl" label="活动落地页" placeholder="https://example.com/activity（选填）"
              extraText="发布时自动生成分享短链，便于短信/海报分发与点击统计"
              rules={[{ validator: (_r, v: string) => !v || /^https?:\/\//.test(v), message: '仅支持 http/https 地址' }]}
            />
            <Form.TextArea field="description" label="活动说明" rows={3} placeholder="活动规则说明（选填）" maxCount={2000} />
          </Form>
        </Spin>
      </AppModal>

      <MarketingPrizesDrawer campaign={prizesCampaign} onClose={() => setPrizesCampaign(null)} />
      <MarketingRecordsDrawer campaign={recordsCampaign} onClose={() => setRecordsCampaign(null)} />
    </div>
  );
}
