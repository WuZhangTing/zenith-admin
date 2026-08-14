import { Card, Empty, List, Spin, Typography } from '@douyinfe/semi-ui';
import { BookOpen, FileCheck2, FileClock, FileText, Flame, MessageSquare, TrendingUp, UserRound } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/charts/StatCard';
import { RefreshButton } from '@/components/toolbar-controls';
import {
  useWikiContributors, useWikiHotDocs, useWikiStaleDocs, useWikiStatsOverview,
} from '@/hooks/queries/wiki-stats';

const { Text } = Typography;

export default function WikiStatsPage() {
  const overviewQuery = useWikiStatsOverview();
  const hotDocsQuery = useWikiHotDocs(10);
  const contributorsQuery = useWikiContributors(10);
  const staleDocsQuery = useWikiStaleDocs(10);

  const overview = overviewQuery.data;
  const refreshing = overviewQuery.isFetching || hotDocsQuery.isFetching
    || contributorsQuery.isFetching || staleDocsQuery.isFetching;

  function handleRefresh() {
    void overviewQuery.refetch();
    void hotDocsQuery.refetch();
    void contributorsQuery.refetch();
    void staleDocsQuery.refetch();
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <RefreshButton onClick={handleRefresh} loading={refreshing} />
      </div>

      <Spin spinning={overviewQuery.isPending}>
        <StatGrid>
          <StatCard title="知识空间" value={overview?.spaceCount ?? 0} icon={<BookOpen size={16} />} />
          <StatCard title="文档总数" value={overview?.docCount ?? 0} icon={<FileText size={16} />} />
          <StatCard title="已发布" value={overview?.publishedCount ?? 0} icon={<FileCheck2 size={16} />} />
          <StatCard title="待审核" value={overview?.pendingCount ?? 0} icon={<FileClock size={16} />} />
          <StatCard title="评论数" value={overview?.commentCount ?? 0} icon={<MessageSquare size={16} />} />
          <StatCard title="本周新增文档" value={overview?.weekNewDocs ?? 0} icon={<TrendingUp size={16} />} />
          <StatCard title="本周浏览量" value={overview?.weekViews ?? 0} icon={<Flame size={16} />} />
        </StatGrid>
      </Spin>

      <div className="auto-grid" style={{ '--auto-grid-cols': 3, marginTop: 16 } as React.CSSProperties}>
        <Card title="热门文档 Top 10" bodyStyle={{ padding: '0 16px' }}>
          <List
            loading={hotDocsQuery.isFetching}
            dataSource={hotDocsQuery.data ?? []}
            emptyContent={<Empty description="暂无数据" />}
            renderItem={(item, idx) => (
              <List.Item
                main={(
                  <div style={{ minWidth: 0 }}>
                    <Text ellipsis={{ showTooltip: true }} style={{ width: '100%' }}>
                      {idx + 1}. {item.title}
                    </Text>
                    <div><Text type="tertiary" size="small">{item.spaceName}</Text></div>
                  </div>
                )}
                extra={<Text type="tertiary">{item.viewCount} 次浏览</Text>}
              />
            )}
          />
        </Card>

        <Card title="贡献榜 Top 10" bodyStyle={{ padding: '0 16px' }}>
          <List
            loading={contributorsQuery.isFetching}
            dataSource={contributorsQuery.data ?? []}
            emptyContent={<Empty description="暂无数据" />}
            renderItem={(item, idx) => (
              <List.Item
                main={(
                  <Text>
                    {idx + 1}. <UserRound size={13} style={{ verticalAlign: -2 }} /> {item.nickname}
                  </Text>
                )}
                extra={<Text type="tertiary">{item.docCount} 篇</Text>}
              />
            )}
          />
        </Card>

        <Card title="沉睡文档（90 天未更新）" bodyStyle={{ padding: '0 16px' }}>
          <List
            loading={staleDocsQuery.isFetching}
            dataSource={staleDocsQuery.data ?? []}
            emptyContent={<Empty description="没有沉睡文档，保持得很好" />}
            renderItem={(item) => (
              <List.Item
                main={(
                  <div style={{ minWidth: 0 }}>
                    <Text ellipsis={{ showTooltip: true }} style={{ width: '100%' }}>{item.title}</Text>
                    <div><Text type="tertiary" size="small">{item.spaceName}</Text></div>
                  </div>
                )}
                extra={<Text type="tertiary" size="small">{item.updatedAt}</Text>}
              />
            )}
          />
        </Card>
      </div>
    </div>
  );
}
