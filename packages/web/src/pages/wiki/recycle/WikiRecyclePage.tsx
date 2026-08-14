import { Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { WikiDoc } from '@zenith/shared/wiki';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { confirmDelete } from '@/utils/confirm';
import { usePurgeWikiDoc, useRestoreWikiDoc, useWikiDocRecycleList, wikiDocRecycleKeys } from '@/hooks/queries/wiki-docs';

interface SearchParams {
  keyword: string;
}

const defaultSearchParams: SearchParams = { keyword: '' };

export default function WikiRecyclePage() {
  const { hasPermission } = usePermission();

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: wikiDocRecycleKeys.all });

  const listQuery = useWikiDocRecycleList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const restoreMutation = useRestoreWikiDoc();
  const purgeMutation = usePurgeWikiDoc();

  const columns: ColumnProps<WikiDoc>[] = [
    { title: '标题', dataIndex: 'title', width: 240, render: renderEllipsis },
    { title: '所属空间', dataIndex: 'spaceName', width: 140, render: renderEllipsis },
    { title: '作者', dataIndex: 'authorName', width: 120, render: (v: string | null) => v ?? '—' },
    dateTimeColumn('删除时间', 'deletedAt'),
    createOperationColumn<WikiDoc>({
      width: 160,
      desktopInlineKeys: ['restore', 'purge'],
      actions: (record) => [
        ...(hasPermission('wiki:recycle:restore') ? [{
          key: 'restore', label: '还原',
          onClick: () => restoreMutation.mutate(record.id, { onSuccess: () => Toast.success('已还原') }),
        }] : []),
        ...(hasPermission('wiki:recycle:purge') ? [{
          key: 'purge', label: '彻底删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: `彻底删除「${record.title}」？`,
              content: '彻底删除后文档及其版本、评论、收藏将全部清除，不可恢复！',
              onOk: async () => {
                await purgeMutation.mutateAsync(record.id);
                Toast.success('已彻底删除');
              },
            });
          },
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
        empty="回收站是空的"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />
    </div>
  );
}
