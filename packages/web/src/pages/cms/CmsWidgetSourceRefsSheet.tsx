import { Button, Empty, SideSheet, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { useCmsWidgetSourceRefs } from '@/hooks/queries/cms-widgets';

export interface CmsWidgetSourceTarget {
  type: 'content' | 'channel';
  id: number;
  name: string;
}

export function CmsWidgetSourceRefsSheet({
  target,
  onClose,
}: {
  target: CmsWidgetSourceTarget | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const query = useCmsWidgetSourceRefs(target?.type ?? 'content', target?.id, !!target);

  return (
    <SideSheet
      title={target ? `页面部件引用 · ${target.name}` : '页面部件引用'}
      visible={!!target}
      onCancel={onClose}
      width={640}
    >
      <Spin spinning={query.isFetching}>
        {(query.data?.length ?? 0) === 0 ? (
          <Empty description="没有已发布页面部件引用该来源" />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {query.data?.map((ref) => (
              <div
                key={`${ref.widgetId}-${ref.itemId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: 14,
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 'var(--semi-border-radius-medium)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text strong ellipsis={{ showTooltip: true }}>
                      {ref.widgetName}
                    </Typography.Text>
                    {ref.highFanout ? <Tag color="red">高影响</Tag> : null}
                  </div>
                  <Typography.Text type="tertiary" size="small">
                    {ref.widgetCode} · 条目 {ref.itemId}
                    {target?.type === 'channel' && ref.sourceType === 'content' ? ` · 经栏目内容 #${ref.sourceId}` : ''}
                    {` · 影响 ${ref.impactCount} 个页面`}
                  </Typography.Text>
                </div>
                <Button
                  theme="borderless"
                  onClick={() => navigate(`/cms/widgets/edit?id=${ref.widgetId}`)}
                >
                  处理
                </Button>
              </div>
            ))}
          </div>
        )}
      </Spin>
    </SideSheet>
  );
}
