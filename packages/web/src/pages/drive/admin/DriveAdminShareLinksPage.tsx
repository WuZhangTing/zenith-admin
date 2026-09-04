import { useState } from 'react';
import { Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { useNavigate } from 'react-router-dom';
import { DRIVE_SHARE_PERMISSION_LABELS, type DriveShareLink, type DriveShareLinkState } from '@zenith/shared/drive';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { FileNameCell } from '@/components/FileNameCell';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { DateRangeFilter, FilterSelect, KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { useListSearch } from '@/hooks/useListSearch';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { driveKeys, useAdminRevokeDriveShareLink, useDriveAdminShareLinks, useDriveShareAccessLogs } from '@/hooks/queries/drive';
import { copyTextWithToast } from '@/utils/clipboard';
import { confirmDanger } from '@/utils/confirm';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { dateTimeColumn, EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import { SHARE_STATE_LABELS, shareLinkAbsoluteUrl, shareLinkStateTag } from '../drive-utils';

interface SearchParams {
  keyword: string;
  state: DriveShareLinkState | undefined;
  timeRange: [Date, Date] | null;
}

const STATE_OPTIONS = (Object.keys(SHARE_STATE_LABELS) as DriveShareLinkState[]).map((v) => ({ value: v, label: SHARE_STATE_LABELS[v] }));

function AccessLogsModal({ link, onClose }: { readonly link: DriveShareLink | null; readonly onClose: () => void }) {
  const { page, pageSize, buildPagination } = usePagination(20);
  const query = useDriveShareAccessLogs(link?.id, { page, pageSize }, !!link);
  const columns: ColumnProps<{ id: number; action: string; clientIp: string | null; ok: boolean; createdAt: string }>[] = [
    { title: '动作', dataIndex: 'action', width: 100, render: (v: string) => ({ access: '访问', download: '下载', preview: '预览', password_fail: '密码错误', save: '转存' }[v] ?? v) },
    { title: 'IP', dataIndex: 'clientIp', minWidth: 140, render: (v: string | null) => v ?? EMPTY_PLACEHOLDER },
    { title: '结果', dataIndex: 'ok', width: 80, render: (v: boolean) => (v ? <Tag size="small" color="green">成功</Tag> : <Tag size="small" color="red">失败</Tag>) },
    dateTimeColumn('时间', 'createdAt'),
  ];
  return (
    <AppModal visible={!!link} title={`访问记录 · ${link?.nodeName ?? ''}`} width={720} footer={null} closeOnEsc onCancel={onClose}>
      <ConfigurableTable bordered size="small" rowKey="id" columns={columns} dataSource={query.data?.list ?? []} loading={query.isFetching}
        pagination={buildPagination(query.data?.total ?? 0)} />
    </AppModal>
  );
}

export default function DriveAdminShareLinksPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { page, pageSize, buildPagination, draftParams, setDraftParams, submittedParams, handleSearch, handleReset } =
    useListSearch<SearchParams>({ defaults: { keyword: '', state: undefined, timeRange: null }, listKey: driveKeys.adminShareLinksPrefix });
  const query = useDriveAdminShareLinks({
    page, pageSize, keyword: submittedParams.keyword || undefined, state: submittedParams.state, ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const revoke = useAdminRevokeDriveShareLink();
  const [logsOf, setLogsOf] = useState<DriveShareLink | null>(null);

  const columns: ColumnProps<DriveShareLink>[] = [
    { title: '文件', dataIndex: 'nodeName', minWidth: 220, ellipsis: { showTitle: false },
      render: (_: unknown, l: DriveShareLink) => <FileNameCell name={l.nodeName} mimeType={l.nodeType === 'folder' ? 'inode/directory' : null} onClick={() => navigate(`/drive?space=${l.spaceId}`)} /> },
    { title: '分享人', dataIndex: 'createdByName', width: 110, render: (v: string | null) => v ?? EMPTY_PLACEHOLDER },
    { title: '状态', dataIndex: 'state', width: 90, render: (v: DriveShareLinkState) => shareLinkStateTag(v) },
    { title: '权限', dataIndex: 'permission', width: 90, render: (v: DriveShareLink['permission']) => DRIVE_SHARE_PERMISSION_LABELS[v] },
    { title: '密码', dataIndex: 'hasPassword', width: 70, render: (v: boolean) => (v ? <Tag size="small" color="orange">有</Tag> : '无') },
    { title: '访问 / 下载', width: 110, render: (_: unknown, l: DriveShareLink) => `${l.accessCount}${l.maxAccessCount ? `/${l.maxAccessCount}` : ''} · ${l.downloadCount}` },
    { title: '备注', dataIndex: 'remark', width: 140, ellipsis: { showTitle: true }, render: (v: string | null) => v ?? EMPTY_PLACEHOLDER },
    dateTimeColumn('过期时间', 'expireAt'),
    dateTimeColumn('创建时间', 'createdAt'),
    createOperationColumn<DriveShareLink>({ width: 170, desktopInlineKeys: ['logs', 'revoke'], actions: (l) => [
      { key: 'logs', label: '访问记录', onClick: () => setLogsOf(l) },
      { key: 'copy', label: '复制链接', disabled: l.state !== 'active', onClick: () => void copyTextWithToast(shareLinkAbsoluteUrl(l), { success: '链接已复制' }) },
      { key: 'revoke', label: '撤销', danger: true, hidden: l.state === 'revoked' || !hasPermission('drive:admin:link:revoke'),
        onClick: () => { confirmDanger({ title: '撤销这条外链？', content: `「${l.nodeName}」的外链将立即失效，访客无法再访问。`, okText: '撤销',
          onOk: () => revoke.mutateAsync({ id: l.id, nodeId: l.nodeId }).then(() => Toast.success('已撤销')) }); } },
    ] }),
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        filters={(
          <>
            <KeywordInput value={draftParams.keyword} placeholder="搜索文件名 / 分享人 / 备注" width={240} onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} />
            <FilterSelect<DriveShareLinkState> value={draftParams.state} placeholder="全部状态" items={STATE_OPTIONS} onChange={(v) => setDraftParams((p) => ({ ...p, state: v }))} />
            <DateRangeFilter value={draftParams.timeRange} onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))} />
          </>
        )}
        actions={(<><SearchButton onClick={handleSearch} /><ResetButton onClick={handleReset} /></>)}
      />
      <ConfigurableTable<DriveShareLink> bordered rowKey="id" columns={columns} dataSource={query.data?.list ?? []}
        loading={query.isFetching} onRefresh={() => void query.refetch()} refreshLoading={query.isFetching}
        pagination={buildPagination(query.data?.total ?? 0)} />
      <AccessLogsModal link={logsOf} onClose={() => setLogsOf(null)} />
      {query.data?.total === 0 && <Typography.Text type="tertiary">暂无外链记录。</Typography.Text>}
    </div>
  );
}
