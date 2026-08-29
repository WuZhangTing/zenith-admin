/**
 * 回放访问审计 Tab：谁在什么时候查看了谁的操作录像（合规留痕，manage 权限）。
 * 同一用户对同一回放 10 分钟内去重，实时旁观轮询不会刷屏。
 */
import { useState } from 'react';
import { Table, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { usePagination } from '@/hooks/usePagination';
import { useReplayAccessLogs, type ReplayAccessLog } from '@/hooks/queries/session-replays';

const { Text } = Typography;

export default function ReplayAccessLogsTab({ onOpenReplay }: Readonly<{ onOpenReplay: (id: string) => void }>) {
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');

  const listQuery = useReplayAccessLogs({ page, pageSize, keyword: submitted || undefined });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns: ColumnProps<ReplayAccessLog>[] = [
    { title: '时间', dataIndex: 'createdAt', width: 170 },
    { title: '操作人', dataIndex: 'username', width: 130, render: (v: string | null, r) => v ?? `用户#${r.userId}` },
    {
      title: '动作', dataIndex: 'action', width: 100,
      render: (v: string) => <Tag size="small" color="blue">{v === 'view' ? '查看回放' : v}</Tag>,
    },
    { title: '录像归属', dataIndex: 'replayOwner', width: 130, render: (v: string | null) => v ?? '—' },
    {
      title: '回放', dataIndex: 'replayId', width: 300,
      render: (v: string) => (
        <Text link size="small" onClick={() => onOpenReplay(v)} style={{ fontFamily: 'monospace' }}>{v}</Text>
      ),
    },
    { title: 'IP', dataIndex: 'ip', width: 140, render: (v: string | null) => v ?? '—' },
  ];

  return (
    <div>
      <SearchToolbar>
        <KeywordInput
          placeholder="操作人/录像归属/回放 ID"
          value={keyword}
          onChange={setKeyword}
          onSearch={() => { setPage(1); setSubmitted(keyword); }}
          width={240}
        />
        <SearchButton onClick={() => { setPage(1); setSubmitted(keyword); }} />
        <ResetButton onClick={() => { setKeyword(''); setSubmitted(''); setPage(1); }} />
      </SearchToolbar>
      <Table
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching && !listQuery.data}
        rowKey="id"
        size="small"
        empty="暂无访问记录（同一用户对同一回放 10 分钟内只留痕一次）"
        pagination={buildPagination(total)}
      />
    </div>
  );
}
