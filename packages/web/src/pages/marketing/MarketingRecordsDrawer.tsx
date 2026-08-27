import { useState } from 'react';
import { Checkbox, SideSheet, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { usePagination } from '@/hooks/usePagination';
import { useMarketingParticipations } from '@/hooks/queries/marketing-campaigns';
import { MARKETING_GRANT_STATUS_LABELS } from '@zenith/shared/marketing';
import type { MarketingCampaign, MarketingParticipation } from '@zenith/shared/marketing';
import { dateTimeColumn, renderEllipsis, EMPTY_PLACEHOLDER } from '@/utils/table-columns';

interface MarketingRecordsDrawerProps {
  campaign: MarketingCampaign | null;
  onClose: () => void;
}

const GRANT_STATUS_COLORS: Record<MarketingParticipation['grantStatus'], string> = {
  none: 'grey',
  granted: 'green',
  failed: 'red',
};

/** 参与/中奖记录抽屉（纯读） */
export default function MarketingRecordsDrawer({ campaign, onClose }: MarketingRecordsDrawerProps) {
  const [wonOnly, setWonOnly] = useState(false);
  const { page, pageSize, buildPagination, resetPage } = usePagination();
  const campaignId = campaign?.id ?? null;
  const recordsQuery = useMarketingParticipations(campaignId, { page, pageSize, wonOnly: wonOnly || undefined });
  const list = recordsQuery.data?.list ?? [];
  const total = recordsQuery.data?.total ?? 0;

  const columns: ColumnProps<MarketingParticipation>[] = [
    { title: '会员', width: 160, render: (_: unknown, r: MarketingParticipation) => r.memberNickname ?? `会员 #${r.memberId}` },
    {
      title: '结果', width: 150,
      render: (_: unknown, r: MarketingParticipation) => r.prizeId
        ? <Tag color="light-blue" size="small">{r.prizeName}</Tag>
        : <Tag color="grey" size="small">未中奖</Tag>,
    },
    {
      title: '发放状态', dataIndex: 'grantStatus', width: 100,
      render: (v: MarketingParticipation['grantStatus'], r: MarketingParticipation) => r.prizeId
        ? <Tag color={GRANT_STATUS_COLORS[v]} size="small">{MARKETING_GRANT_STATUS_LABELS[v]}</Tag>
        : EMPTY_PLACEHOLDER,
    },
    { title: '备注', dataIndex: 'grantNote', width: 220, render: renderEllipsis },
    dateTimeColumn('参与时间', 'createdAt'),
  ];

  return (
    <SideSheet
      title={`参与记录${campaign ? ` · ${campaign.name}` : ''}`}
      visible={campaign !== null}
      onCancel={onClose}
      width={820}
      closeOnEsc
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Checkbox
          checked={wonOnly}
          onChange={(e) => {
            setWonOnly(Boolean(e.target.checked));
            resetPage();
          }}
        >
          只看中奖记录
        </Checkbox>
        <ConfigurableTable
          bordered
          columns={columns}
          dataSource={list}
          loading={recordsQuery.isFetching}
          rowKey="id"
          size="small"
          empty="暂无参与记录"
          onRefresh={() => void recordsQuery.refetch()}
          refreshLoading={recordsQuery.isFetching}
          pagination={buildPagination(total)}
        />
      </div>
    </SideSheet>
  );
}
