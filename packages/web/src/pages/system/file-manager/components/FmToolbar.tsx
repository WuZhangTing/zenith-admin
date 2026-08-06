/** 顶部工具栏：操作按钮区（FmToolbarActions）与导航区（FmToolbarNav） */
import React from 'react';
import { Breadcrumb, Button, Input, Popconfirm, Space, Tooltip } from '@douyinfe/semi-ui';
import {
  Archive, ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff, FilePlus, FolderPlus, FolderUp,
  LayoutGrid, List as ListIcon, PencilLine, RotateCcw, Scissors, Search, Star, Trash2, Upload as UploadIcon,
} from 'lucide-react';
import type { ClipOp, ViewMode } from '../types';

interface FmToolbarActionsProps {
  readonly keyword: string;
  readonly onKeywordChange: (v: string) => void;
  readonly searchKw: string;
  readonly onSearchKwChange: (v: string) => void;
  readonly onRunSearch: () => void;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly onNewDir: () => void;
  readonly onNewFile: () => void;
  readonly onUploadFiles: () => void;
  readonly onUploadDir: () => void;
  readonly isBookmarked: boolean;
  readonly onToggleBookmark: () => void;
  readonly clipboard: { paths: string[]; op: ClipOp } | null;
  readonly pasteLoading: boolean;
  readonly onPaste: () => void;
  readonly selectedCount: number;
  readonly onBatchDownload: () => void;
  readonly onBatchCopy: () => void;
  readonly onBatchCut: () => void;
  readonly onBatchCompress: () => void;
  readonly onBatchDelete: () => void;
  readonly deleteLoading: boolean;
  readonly showHidden: boolean;
  readonly onToggleHidden: () => void;
  readonly viewMode: ViewMode;
  readonly onViewModeChange: (m: ViewMode) => void;
}

export function FmToolbarActions({
  keyword, onKeywordChange, searchKw, onSearchKwChange, onRunSearch, loading, onRefresh,
  onNewDir, onNewFile, onUploadFiles, onUploadDir, isBookmarked, onToggleBookmark,
  clipboard, pasteLoading, onPaste, selectedCount, onBatchDownload, onBatchCopy, onBatchCut,
  onBatchCompress, onBatchDelete, deleteLoading, showHidden, onToggleHidden, viewMode, onViewModeChange,
}: Readonly<FmToolbarActionsProps>) {
  return (
    <Space className="fm-toolbar__actions" spacing={6} style={{ flexShrink: 0 }}>
      {selectedCount > 0 ? (
        <>
          <Button size="small" theme="borderless" type="tertiary" icon={<Download size={13} />} onClick={onBatchDownload}>下载</Button>
          <Button size="small" theme="borderless" type="tertiary" icon={<Copy size={13} />} onClick={onBatchCopy}>复制</Button>
          <Button size="small" theme="borderless" type="tertiary" icon={<Scissors size={13} />} onClick={onBatchCut}>剪切</Button>
          <Button size="small" theme="borderless" type="tertiary" icon={<Archive size={13} />} onClick={onBatchCompress}>压缩</Button>
          <Popconfirm title={`确定删除选中的 ${selectedCount} 项吗？`} okType="danger" onConfirm={onBatchDelete}>
            <Button size="small" theme="borderless" type="danger" icon={<Trash2 size={13} />} loading={deleteLoading}>删除</Button>
          </Popconfirm>
        </>
      ) : (
        <>
          <Input
            prefix={<Search size={13} />}
            placeholder="过滤文件名"
            value={keyword}
            onChange={onKeywordChange}
            showClear
            size="small"
            style={{ width: 160 }}
          />
          <Input
            prefix={<Search size={13} />}
            placeholder="深度搜索(回车)"
            value={searchKw}
            onChange={onSearchKwChange}
            onEnterPress={onRunSearch}
            showClear
            size="small"
            style={{ width: 150 }}
          />
          <Tooltip content="刷新">
            <Button size="small" theme="borderless" type="tertiary" icon={<RotateCcw size={13} />} loading={loading} onClick={onRefresh} />
          </Tooltip>
          <Tooltip content="新建文件夹">
            <Button size="small" theme="borderless" type="tertiary" icon={<FolderPlus size={13} />} onClick={onNewDir} />
          </Tooltip>
          <Tooltip content="新建文件">
            <Button size="small" theme="borderless" type="tertiary" icon={<FilePlus size={13} />} onClick={onNewFile} />
          </Tooltip>
          <Tooltip content="上传文件">
            <Button size="small" theme="borderless" type="tertiary" icon={<UploadIcon size={13} />} onClick={onUploadFiles} />
          </Tooltip>
          <Tooltip content="上传文件夹">
            <Button size="small" theme="borderless" type="tertiary" icon={<FolderUp size={13} />} onClick={onUploadDir} />
          </Tooltip>
          <Tooltip content={isBookmarked ? '取消收藏当前目录' : '收藏当前目录'}>
            <Button
              size="small"
              theme="borderless"
              type={isBookmarked ? 'warning' : 'tertiary'}
              icon={<Star size={13} fill={isBookmarked ? 'currentColor' : 'none'} />}
              onClick={onToggleBookmark}
            />
          </Tooltip>
        </>
      )}
      {clipboard && (
        <Tooltip content={`粘贴（${clipboard.op === 'copy' ? '复制' : '移动'} ${clipboard.paths.length} 项）`}>
          <Button
            size="small"
            type="primary"
            icon={clipboard.op === 'copy' ? <Copy size={13} /> : <Scissors size={13} />}
            loading={pasteLoading}
            onClick={onPaste}
          >
            粘贴
          </Button>
        </Tooltip>
      )}
      <Tooltip content={showHidden ? '隐藏点文件' : '显示隐藏文件'}>
        <Button
          size="small"
          theme={showHidden ? 'solid' : 'borderless'}
          type={showHidden ? 'primary' : 'tertiary'}
          icon={showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
          onClick={onToggleHidden}
        />
      </Tooltip>
      <Button
        size="small"
        theme={viewMode === 'list' ? 'solid' : 'borderless'}
        type={viewMode === 'list' ? 'primary' : 'tertiary'}
        icon={<ListIcon size={13} />}
        style={{ borderRadius: '4px 0 0 4px' }}
        onClick={() => onViewModeChange('list')}
      />
      <Button
        size="small"
        theme={viewMode === 'grid' ? 'solid' : 'borderless'}
        type={viewMode === 'grid' ? 'primary' : 'tertiary'}
        icon={<LayoutGrid size={13} />}
        style={{ borderRadius: '0 4px 4px 0' }}
        onClick={() => onViewModeChange('grid')}
      />
    </Space>
  );
}

interface FmToolbarNavProps {
  readonly canBack: boolean;
  readonly canForward: boolean;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly pathEditing: boolean;
  readonly pathDraft: string;
  readonly onPathDraftChange: (v: string) => void;
  readonly onPathEditingChange: (editing: boolean) => void;
  readonly onStartPathEdit: () => void;
  readonly currentPath: string;
  readonly breadcrumbs: { label: string; path: string }[];
  readonly onNavigate: (path: string) => void;
}

export function FmToolbarNav({
  canBack, canForward, onBack, onForward, pathEditing, pathDraft, onPathDraftChange,
  onPathEditingChange, onStartPathEdit, currentPath, breadcrumbs, onNavigate,
}: Readonly<FmToolbarNavProps>) {
  return (
    <div className="fm-toolbar__nav">
      <Tooltip content="后退">
        <Button size="small" theme="borderless" type="tertiary" icon={<ChevronLeft size={14} />} disabled={!canBack} onClick={onBack} />
      </Tooltip>
      <Tooltip content="前进">
        <Button size="small" theme="borderless" type="tertiary" icon={<ChevronRight size={14} />} disabled={!canForward} onClick={onForward} />
      </Tooltip>
      {pathEditing ? (
        <Input
          size="small"
          value={pathDraft}
          onChange={onPathDraftChange}
          autoFocus
          placeholder="输入路径后回车直达"
          style={{ flex: 1, minWidth: 0, fontFamily: 'monospace' }}
          onEnterPress={() => {
            const p = pathDraft.trim();
            onPathEditingChange(false);
            if (p && p !== currentPath) onNavigate(p);
          }}
          onBlur={() => onPathEditingChange(false)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onPathEditingChange(false); } }}
        />
      ) : (
        <>
          <Breadcrumb className="fm-toolbar__breadcrumb">
            {breadcrumbs.map((seg, i) => (
              <Breadcrumb.Item
                key={seg.path}
                onClick={i < breadcrumbs.length - 1 ? () => onNavigate(seg.path) : undefined}
                style={{ cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default', color: i < breadcrumbs.length - 1 ? 'var(--semi-color-primary)' : undefined }}
              >
                {seg.label}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
          <Tooltip content="编辑路径（Ctrl+L）">
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<PencilLine size={12} />}
              onClick={onStartPathEdit}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}
