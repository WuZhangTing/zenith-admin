import type { ReactNode } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import './WorkflowInstanceCell.css';

/**
 * 流程实例标题单元格（全局统一）。
 *
 * 运维/监控/巡检等所有表格中展示"实例标题"的地方统一使用本组件：
 * - 主行：实例标题（缺省回退 `#id`）；提供 `onOpen` 时渲染为可点击链接；
 * - 副行：`serialNo ?? #id` 与流程名、附加信息（· 分隔），可用 `showSub` 关闭
 *   （页面已有独立"流程名称"列时关闭副行，避免重复）。
 */
export default function WorkflowInstanceCell({
  instanceId,
  title,
  serialNo,
  definitionName,
  extra,
  showSub = true,
  size = 'normal',
  emptyText = '—',
  onOpen,
  action,
}: Readonly<{
  instanceId?: number | null;
  /** 实例标题；为空时主行回退显示 #id */
  title?: string | null;
  serialNo?: string | null;
  /** 副行流程名（页面有独立流程列时不传） */
  definitionName?: string | null;
  /** 副行附加片段（如 nodeKey） */
  extra?: string | null;
  showSub?: boolean;
  size?: 'normal' | 'small';
  /** instanceId 与 title 都为空时显示的占位文案 */
  emptyText?: string;
  /** 点击主行打开实例详情 */
  onOpen?: (instanceId: number) => void;
  /** 主行右侧的动作区（如打开诊断按钮） */
  action?: ReactNode;
}>) {
  if (instanceId == null && !title) {
    return <Typography.Text size={size} type="tertiary">{emptyText}</Typography.Text>;
  }

  const main = title || `#${instanceId}`;
  const subParts = [
    serialNo ?? (title && instanceId != null ? `#${instanceId}` : null),
    definitionName,
    extra,
  ].filter(Boolean);
  const clickable = onOpen != null && instanceId != null;

  const mainNode = clickable ? (
    <Typography.Text
      link
      size={size}
      className="wf-instance-cell-link"
      ellipsis={{ showTooltip: true }}
      style={{ maxWidth: '100%' }}
      onClick={() => onOpen(instanceId)}
    >
      {main}
    </Typography.Text>
  ) : (
    <Typography.Text size={size} strong ellipsis={{ showTooltip: true }} style={{ display: 'block', maxWidth: '100%' }}>
      {main}
    </Typography.Text>
  );

  return (
    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {mainNode}
        {showSub && subParts.length > 0 && (
          <div>
            <Typography.Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', maxWidth: '100%' }}>
              {subParts.join(' · ')}
            </Typography.Text>
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
