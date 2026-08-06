import React from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FmToolbarActions } from './FmToolbar';

const baseProps: ComponentProps<typeof FmToolbarActions> = {
  keyword: '',
  onKeywordChange: vi.fn(),
  searchKw: '',
  onSearchKwChange: vi.fn(),
  onRunSearch: vi.fn(),
  loading: false,
  onRefresh: vi.fn(),
  onNewDir: vi.fn(),
  onNewFile: vi.fn(),
  onUploadFiles: vi.fn(),
  onUploadDir: vi.fn(),
  isBookmarked: false,
  onToggleBookmark: vi.fn(),
  clipboard: null,
  pasteLoading: false,
  onPaste: vi.fn(),
  selectedCount: 0,
  onBatchDownload: vi.fn(),
  onBatchCopy: vi.fn(),
  onBatchCut: vi.fn(),
  onBatchCompress: vi.fn(),
  onBatchDelete: vi.fn(),
  deleteLoading: false,
  showHidden: false,
  onToggleHidden: vi.fn(),
  viewMode: 'list',
  onViewModeChange: vi.fn(),
};

describe('FmToolbarActions', () => {
  it('replaces normal controls with batch actions while entries are selected', () => {
    const { rerender } = render(<FmToolbarActions {...baseProps} />);

    expect(screen.getByPlaceholderText('过滤文件名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('深度搜索(回车)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下载' })).not.toBeInTheDocument();

    rerender(<FmToolbarActions {...baseProps} selectedCount={1} />);

    expect(screen.queryByPlaceholderText('过滤文件名')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('深度搜索(回车)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '剪切' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '压缩' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
  });
});
