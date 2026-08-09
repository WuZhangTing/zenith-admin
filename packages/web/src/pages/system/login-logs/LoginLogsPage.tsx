import { Select, Tabs, TabPane } from '@douyinfe/semi-ui';
import { SearchToolbar } from '@/components/SearchToolbar';
import ExportButton from '@/components/ExportButton';
import { LoginLogsTable } from '@/components/logs/LoginLogsTable';
import { ClearLogsButtons, ClearLogsMobileButtons, ClearLogsModal } from '@/components/logs/ClearLogsControl';
import { useClearLogs } from '@/hooks/useClearLogs';
import { formatDateTimeRangeForApi } from '@/utils/date';
import LoginLogStatsPanel from './LoginLogStatsPanel';
import { loginLogKeys, useCleanLoginLogs, useLoginLogList } from '@/hooks/queries/login-logs';
import { useListSearch } from '@/hooks/useListSearch';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { DateRangeFilter, KeywordInput } from '@/components/search-filters';

export default function LoginLogsPage() {
  interface SearchParams {
    username: string;
    eventType: string;
    status: string;
    timeRange: [Date, Date] | null;
  }

  const defaultParams: SearchParams = { username: '', eventType: '', status: '', timeRange: null };

  const {
    page, pageSize, setPage, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultParams, listKey: loginLogKeys.all });
  const listQuery = useLoginLogList({
    page,
    pageSize,
    username: submittedParams.username || undefined,
    eventType: submittedParams.eventType || undefined,
    status: submittedParams.status || undefined,
    ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const cleanLogsMutation = useCleanLoginLogs();
  const clearLogsLoading = cleanLogsMutation.isPending;
  const clearLogs = useClearLogs({
    clean: (months) => cleanLogsMutation.mutateAsync(months),
    onCleared: () => setPage(1),
  });

  const renderUsernameSearch = () => (
    <KeywordInput placeholder="请输入用户名" value={draftParams.username} onChange={(v) => setDraftParams({ ...draftParams, username: v })} onSearch={handleSearch} width={180} />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="请选择状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams({ ...draftParams, status: v as string })}
      style={{ width: 150 }}
    >
      <Select.Option value="">全部</Select.Option>
      <Select.Option value="success">成功</Select.Option>
      <Select.Option value="fail">失败</Select.Option>
    </Select>
  );

  const renderEventTypeFilter = () => (
    <Select
      placeholder="请选择事件"
      value={draftParams.eventType || undefined}
      onChange={(v) => setDraftParams({ ...draftParams, eventType: v as string })}
      style={{ width: 150 }}
    >
      <Select.Option value="">全部事件</Select.Option>
      <Select.Option value="login">登录</Select.Option>
      <Select.Option value="logout">退出登录</Select.Option>
    </Select>
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter value={draftParams.timeRange ?? undefined} onChange={(v) => setDraftParams({ ...draftParams, timeRange: v ? (v as [Date, Date]) : null })} />
  );

  const buildExportQuery = () => ({
    ...(draftParams.username ? { username: draftParams.username } : {}),
    ...(draftParams.eventType ? { eventType: draftParams.eventType } : {}),
    ...(draftParams.status ? { status: draftParams.status } : {}),
    ...(draftParams.timeRange
      ? formatDateTimeRangeForApi(draftParams.timeRange)
      : {}),
  });

  const renderExportButtons = () => <ExportButton entity="system.login-logs" query={buildExportQuery()} />;

  const renderMobileExportActions = () => <ExportButton entity="system.login-logs" query={buildExportQuery()} variant="flat" />;

  const renderClearButtons = () => <ClearLogsButtons loading={clearLogsLoading} onClear={clearLogs.openClearModal} />;

  const renderMobileClearActions = () => <ClearLogsMobileButtons loading={clearLogsLoading} onClear={clearLogs.openClearModal} />;

  return (
    <div className="page-container page-tabs-page">
      <Tabs type="line">
        <TabPane tab="日志列表" itemKey="list">
          <SearchToolbar
            primary={(
              <>
                {renderUsernameSearch()}
                {renderEventTypeFilter()}
                {renderStatusFilter()}
                {renderTimeRangeFilter()}
                <SearchButton onClick={handleSearch} />
                <ResetButton onClick={handleReset} />
              </>
            )}
            actions={(
              <>
                {renderExportButtons()}
                {renderClearButtons()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderUsernameSearch()}
                <SearchButton onClick={handleSearch} />
              </>
            )}
            mobileFilters={(
              <>
                {renderEventTypeFilter()}
                {renderStatusFilter()}
                {renderTimeRangeFilter()}
              </>
            )}
            mobileActions={(
              <>
                {renderMobileExportActions()}
                {renderMobileClearActions()}
              </>
            )}
            filterTitle="登录日志筛选"
            actionTitle="日志操作"
            onFilterApply={handleSearch}
            onFilterReset={handleReset}
          />

          <LoginLogsTable
            dataSource={data}
            loading={listQuery.isFetching}
            onRefresh={() => void listQuery.refetch()}
            pagination={buildPagination(total)}
          />
        </TabPane>
        <TabPane tab="统计分析" itemKey="stats">
          <LoginLogStatsPanel />
        </TabPane>
      </Tabs>
      <ClearLogsModal logName="登录日志" control={clearLogs} />
    </div>
  );
}
