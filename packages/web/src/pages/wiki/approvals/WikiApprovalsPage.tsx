import { useState } from 'react';
import { Button, Space, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Check, X } from 'lucide-react';
import type { WikiDoc } from '@zenith/shared/wiki';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import MarkdownPreviewPanel from '@/components/MarkdownPreviewPanel';
import { renderEllipsis, updatedAtColumn } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useReviewWikiDoc, useWikiDocDetail, useWikiDocList, wikiDocKeys } from '@/hooks/queries/wiki-docs';

const { Text } = Typography;

interface SearchParams {
  keyword: string;
}

const defaultSearchParams: SearchParams = { keyword: '' };

export default function WikiApprovalsPage() {
  const { hasPermission } = usePermission();
  const canReview = hasPermission('wiki:approval:review');

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: wikiDocKeys.lists });

  const listQuery = useWikiDocList({
    page,
    pageSize,
    status: 'pending',
    keyword: submittedParams.keyword || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const reviewMutation = useReviewWikiDoc();

  // ─── 预览与驳回 ────────────────────────────────────────────────────────────
  const [previewId, setPreviewId] = useState<number>();
  const previewQuery = useWikiDocDetail(previewId);
  const [rejectTarget, setRejectTarget] = useState<WikiDoc | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  function handleApprove(record: WikiDoc) {
    reviewMutation.mutate(
      { id: record.id, action: 'approve' },
      { onSuccess: () => { Toast.success('已通过并发布'); setPreviewId(undefined); } },
    );
  }

  function handleReject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Toast.warning('请填写驳回意见');
      return;
    }
    reviewMutation.mutate(
      { id: rejectTarget.id, action: 'reject', reason },
      {
        onSuccess: () => {
          Toast.success('已驳回');
          setRejectTarget(null);
          setRejectReason('');
          setPreviewId(undefined);
        },
      },
    );
  }

  const columns: ColumnProps<WikiDoc>[] = [
    { title: '标题', dataIndex: 'title', width: 240, render: renderEllipsis },
    { title: '所属空间', dataIndex: 'spaceName', width: 140, render: renderEllipsis },
    { title: '作者', dataIndex: 'authorName', width: 120, render: (v: string | null) => v ?? '—' },
    { title: '版本', dataIndex: 'currentVersion', width: 80, render: (v: number) => `v${v}` },
    updatedAtColumn,
    createOperationColumn<WikiDoc>({
      width: 200,
      desktopInlineKeys: ['preview', 'approve', 'reject'],
      actions: (record) => [
        { key: 'preview', label: '预览', onClick: () => setPreviewId(record.id) },
        ...(canReview ? [{
          key: 'approve', label: '通过',
          onClick: () => handleApprove(record),
        }, {
          key: 'reject', label: '驳回', danger: true,
          onClick: () => { setRejectTarget(record); setRejectReason(''); },
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索标题..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
        </>}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="没有待审核的文档"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      {/* 预览弹窗 */}
      <AppModal
        title={previewQuery.data?.title ?? '文档预览'}
        visible={previewId !== undefined}
        closeOnEsc
        width={860}
        onCancel={() => setPreviewId(undefined)}
        footer={canReview && previewQuery.data ? (
          <Space spacing={8}>
            <Button
              icon={<X size={14} />}
              type="danger"
              onClick={() => { setRejectTarget(previewQuery.data!); setRejectReason(''); }}
            >
              驳回
            </Button>
            <Button
              theme="solid"
              icon={<Check size={14} />}
              loading={reviewMutation.isPending}
              onClick={() => handleApprove(previewQuery.data!)}
            >
              通过并发布
            </Button>
          </Space>
        ) : null}
      >
        <div style={{ height: '60vh', overflow: 'hidden', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)' }}>
          <MarkdownPreviewPanel content={previewQuery.data?.content ?? ''} />
        </div>
      </AppModal>

      {/* 驳回弹窗 */}
      <AppModal
        title={`驳回「${rejectTarget?.title ?? ''}」`}
        visible={!!rejectTarget}
        closeOnEsc
        width={480}
        onCancel={() => setRejectTarget(null)}
        onOk={handleReject}
        okText="确认驳回"
        okButtonProps={{ type: 'danger', loading: reviewMutation.isPending }}
      >
        <Text type="tertiary">驳回后文档回到作者的草稿箱，作者可修改后重新提交。</Text>
        <TextArea
          style={{ marginTop: 12 }}
          value={rejectReason}
          onChange={setRejectReason}
          placeholder="请填写驳回意见（必填）"
          rows={4}
          maxCount={500}
        />
      </AppModal>
    </div>
  );
}
