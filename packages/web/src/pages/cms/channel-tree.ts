import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import type { CmsChannel } from '@zenith/shared/cms';
import { mapTree } from '@zenith/shared/core';

/** 栏目树 → Semi 树节点（key / value 为栏目 id） */
export function channelsToTree(nodes: CmsChannel[]): TreeNodeData[] {
  return mapTree<CmsChannel, TreeNodeData>(nodes, (n) => ({ key: String(n.id), value: n.id, label: n.name }));
}

/** 内容归属栏目选择：仅列表型栏目可选，其余节点禁用 */
export function channelsToSelectTree(nodes: CmsChannel[]): TreeNodeData[] {
  return mapTree<CmsChannel, TreeNodeData>(nodes, (n) => ({ key: String(n.id), value: n.id, label: n.name, disabled: n.type !== 'list' }));
}
