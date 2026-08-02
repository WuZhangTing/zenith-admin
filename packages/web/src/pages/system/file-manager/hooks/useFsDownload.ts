/**
 * 下载：单文件直下（受保护端点走带 token 的 fetch + blob）；
 * 批量/含目录时先压缩为服务器临时 ZIP，下载完成后清理。
 */
import { useCallback } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import dayjs from 'dayjs';
import { TOKEN_KEY } from '@zenith/shared/core';
import { config as appConfig } from '@/config';
import type { UseMutationResult } from '@tanstack/react-query';
import { joinPath } from '../fs-utils';
import type { FsEntry } from '../types';

interface UseFsDownloadArgs {
  currentPath: string;
  filteredEntries: FsEntry[];
  selectedPaths: Set<string>;
  fileOperationMutation: UseMutationResult<null, Error, { endpoint: string; values: Record<string, unknown> }>;
  deleteEntriesMutation: UseMutationResult<number, Error, string[]>;
}

export function useFsDownload({ currentPath, filteredEntries, selectedPaths, fileOperationMutation, deleteEntriesMutation }: UseFsDownloadArgs) {
  /** 按服务器路径下载文件（受保护端点走 fetch + blob） */
  const downloadByPath = useCallback(async (path: string, fileName: string): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY) ?? '';
    const base = appConfig.apiBaseUrl || '';
    const resp = await fetch(`${base}/api/terminal-files/download?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('下载失败');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

  const handleDownload = useCallback((entry: FsEntry) => {
    void downloadByPath(entry.path, entry.name).catch(() => Toast.error('下载失败'));
  }, [downloadByPath]);

  /** 批量下载：单个文件直下；多项 / 含目录先压缩为临时 ZIP，下载后清理服务器临时包 */
  const handleBatchDownload = async () => {
    const sel = filteredEntries.filter((e) => selectedPaths.has(e.path));
    if (sel.length === 0) return;
    if (sel.length === 1 && sel[0].type === 'file') {
      handleDownload(sel[0]);
      return;
    }
    const zipName = `打包下载_${dayjs().format('YYYYMMDDHHmmss')}.zip`;
    const dest = joinPath(currentPath, zipName);
    Toast.info({ content: `正在打包 ${sel.length} 项…`, duration: 2 });
    try {
      await fileOperationMutation.mutateAsync({ endpoint: '/api/terminal-files/compress', values: { paths: sel.map((e) => e.path), destPath: dest } });
      await downloadByPath(dest, zipName);
      Toast.success('打包下载完成');
    } catch {
      Toast.error('打包下载失败');
    } finally {
      // 清理服务器上的临时压缩包
      await deleteEntriesMutation.mutateAsync([dest]).catch(() => {});
    }
  };

  return { handleDownload, handleBatchDownload };
}
