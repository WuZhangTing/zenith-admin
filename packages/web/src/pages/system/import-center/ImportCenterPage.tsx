/**
 * 数据导入中心：可导入实体卡片墙 + 导入历史（任务中心 data-import 过滤视图）。
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, Card, Col, Empty, Row, Spin, Table, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { FileSpreadsheet } from 'lucide-react';
import type { AsyncTask, ImportEntityMeta } from '@zenith/shared/tasks';
import ImportButton from '@/components/ImportButton';
import AsyncTaskProgress from '@/components/AsyncTaskProgress';
import { usePagination } from '@/hooks/usePagination';
import { useImportEntities } from '@/hooks/queries/import-jobs';
import { asyncTaskKeys, useAsyncTaskList } from '@/hooks/queries/async-tasks';

const { Text, Title } = Typography;

const TASK_STATUS_META = {
  pending: { label: '排队中', color: 'grey' },
  running: { label: '执行中', color: 'blue' },
  success: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'grey' },
} as const satisfies Record<AsyncTask['status'], { label: string; color: string }>;

export default function ImportCenterPage() {
  const qc = useQueryClient();
  const entitiesQuery = useImportEntities();
  const entities = useMemo(() => entitiesQuery.data ?? [], [entitiesQuery.data]);
  const { page, pageSize, buildPagination } = usePagination();

  const listQuery = useAsyncTaskList({ page, pageSize, taskType: 'data-import' });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const grouped = useMemo(() => {
    const byModule = new Map<string, ImportEntityMeta[]>();
    for (const e of entities) {
      const group = byModule.get(e.module) ?? [];
      group.push(e);
      byModule.set(e.module, group);
    }
    return [...byModule.entries()];
  }, [entities]);

  const columns: ColumnProps<AsyncTask>[] = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '任务', dataIndex: 'title', width: 260, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: AsyncTask['status']) => {
        const meta = TASK_STATUS_META[v] ?? { label: v, color: 'grey' as const };
        return <Tag size="small" color={meta.color as 'grey'}>{meta.label}</Tag>;
      },
    },
    {
      title: '进度', width: 220,
      render: (_: unknown, r: AsyncTask) => <AsyncTaskProgress task={r} noteDisplay="tooltip" />,
    },
    { title: '提交人', dataIndex: 'createdByName', width: 110, render: (v: string | null) => v ?? '—' },
    { title: '提交时间', dataIndex: 'createdAt', width: 160 },
  ];

  return (
    <div className="page-container zx-flat-panels">
      <Banner
        fullMode={false} type="info" closeIcon={null} style={{ marginBottom: 16 }}
        description="下载模板 → 填写数据 → 上传提交。任务异步执行，逐行校验并给出行级成败明细；失败行修正后可重新上传。"
      />

      <Spin spinning={entitiesQuery.isPending}>
        {entities.length === 0 && entitiesQuery.isFetched ? (
          <Empty title="暂无可导入的实体" description="没有任何导入权限，请联系管理员" style={{ padding: '32px 0' }} />
        ) : (
          grouped.map(([module, items]) => (
            <div key={module} style={{ marginBottom: 20 }}>
              <Title heading={6} style={{ marginBottom: 12 }}>{module}</Title>
              <Row gutter={[16, 16]}>
                {items.map((entity) => (
                  <Col key={entity.entity} span={8} xs={24} sm={12} lg={8}>
                    <Card
                      title={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <FileSpreadsheet size={16} />
                          {entity.title}
                        </span>
                      )}
                      headerExtraContent={(
                        <ImportButton
                          entity={entity.entity}
                          title={entity.title}
                          onFinished={() => void qc.invalidateQueries({ queryKey: asyncTaskKeys.lists })}
                        />
                      )}
                    >
                      <Text type="tertiary" size="small" style={{ display: 'block', minHeight: 40 }}>
                        {entity.description ?? `批量导入${entity.title}数据`}
                      </Text>
                      <Text type="quaternary" size="small">
                        {entity.columns.length} 个字段 · 单次最多 {entity.maxRows} 行
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ))
        )}
      </Spin>

      <Title heading={6} style={{ margin: '8px 0 12px' }}>导入历史</Title>
      <Table
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无导入记录"
        pagination={buildPagination(total)}
      />
      <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
        行级明细请到「任务中心」查看对应任务。
      </Text>
    </div>
  );
}
