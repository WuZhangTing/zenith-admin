import type { QueryClient } from '@tanstack/react-query';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AsyncTask } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { dockerKeys } from './docker';

/**
 * `/api/terminal-files/*` 域的唯一 hooks 文件。
 *
 * 服务宿主机文件系统的所有前端消费者：文件管理器页（FileManagerPage）与
 * 终端页的三个 Explorer（本地/SFTP/Docker）+ 在线编辑（EditorTab）。
 * 此前拆在 file-manager.ts / terminal-files.ts 两处、query key 命名空间
 * 各自为政（['file-manager',…] vs ['terminal-files',…]），文件管理器里的
 * 增删改不会失效终端侧同目录缓存；合并后统一走 terminalFileKeys。
 */

/** 宿主机文件系统条目（permissions/uid/gid 仅 POSIX 平台返回） */
export interface FsEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  permissions?: string;
  uid?: number;
  gid?: number;
}
export interface DirListing {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}
export interface RootInfo {
  home: string;
  isWindows: boolean;
  drives: string[];
}
export interface SftpEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  permissions?: string;
}
export interface SftpListing {
  path: string;
  parent: string | null;
  entries: SftpEntry[];
}
export interface DockerFileEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink';
}
export interface FileContent {
  path: string;
  content: string;
  size: number;
  /** 版本标识；保存时回传，服务端据此拒绝覆盖他人的修改 */
  etag: string;
}

/** 递归搜索结果；truncated 表示触顶提前结束，结果不完整 */
export interface FileSearchResult {
  entries: FsEntry[];
  truncated: boolean;
}

export const terminalFileKeys = {
  all: ['terminal-files'] as const,
  rootInfo: ['terminal-files', 'root-info'] as const,
  localBrowsePrefix: ['terminal-files', 'browse'] as const,
  localBrowse: (path: string) => ['terminal-files', 'browse', 'local', path] as const,
  localContent: (path: string) => ['terminal-files', 'content', 'local', path] as const,
  checksumPrefix: ['terminal-files', 'checksum'] as const,
  checksum: (path: string | undefined, algo: string | undefined) => ['terminal-files', 'checksum', path, algo] as const,
  search: (dir: string, keyword: string) => ['terminal-files', 'search', dir, keyword] as const,
  dirSizePrefix: ['terminal-files', 'dir-size'] as const,
  dirSize: (path: string | undefined) => ['terminal-files', 'dir-size', path] as const,
  sftpHome: (profileId: number) => ['terminal-files', 'sftp-home', profileId] as const,
  sftpBrowsePrefix: (profileId: number) => ['terminal-files', 'browse', 'sftp', profileId] as const,
  sftpBrowse: (profileId: number, path: string) => ['terminal-files', 'browse', 'sftp', profileId, path] as const,
  sftpContent: (profileId: string, path: string) => ['terminal-files', 'content', 'sftp', profileId, path] as const,
  hostHome: (hostId: number) => ['terminal-files', 'host-home', hostId] as const,
  hostBrowsePrefix: (hostId: number) => ['terminal-files', 'browse', 'host', hostId] as const,
  hostBrowse: (hostId: number, path: string) => ['terminal-files', 'browse', 'host', hostId, path] as const,
  hostContent: (hostId: number, path: string) => ['terminal-files', 'content', 'host', hostId, path] as const,
  dockerBrowsePrefix: (containerId: string) => ['terminal-files', 'browse', 'docker', containerId] as const,
  dockerBrowse: (containerId: string, path: string) => ['terminal-files', 'browse', 'docker', containerId, path] as const,
  dockerContent: (containerId: string, path: string) => ['terminal-files', 'content', 'docker', containerId, path] as const,
};

export const rootInfoQueryOptions = () => ({
  queryKey: terminalFileKeys.rootInfo,
  queryFn: () => request.get<RootInfo>('/api/terminal-files/root-info').then(unwrap),
});

export const localBrowseQueryOptions = (path: string, options?: { silent?: boolean }) => ({
  queryKey: terminalFileKeys.localBrowse(path),
  queryFn: () => request.get<DirListing>(`/api/terminal-files/list?path=${encodeURIComponent(path)}`, { silent: options?.silent }).then(unwrap),
});

export const sftpHomeQueryOptions = (profileId: number) => ({
  queryKey: terminalFileKeys.sftpHome(profileId),
  queryFn: () => request.get<{ home: string }>(`/api/ssh-sftp/${profileId}/home`, { silent: true }).then(unwrap),
});

export const sftpBrowseQueryOptions = (profileId: number, path: string, options?: { silent?: boolean }) => ({
  queryKey: terminalFileKeys.sftpBrowse(profileId, path),
  queryFn: () => request.get<SftpListing>(`/api/ssh-sftp/${profileId}/list?path=${encodeURIComponent(path)}`, { silent: options?.silent }).then(unwrap),
});

export const hostBrowseQueryOptions = (hostId: number, path: string, options?: { silent?: boolean }) => ({
  queryKey: terminalFileKeys.hostBrowse(hostId, path),
  queryFn: () => request.get<SftpListing>(`/api/host-files/${hostId}/list?path=${encodeURIComponent(path)}`, { silent: options?.silent }).then(unwrap),
});

export function useHostFileHome(hostId: number) {
  return useQuery({
    queryKey: terminalFileKeys.hostHome(hostId),
    queryFn: () => request.get<{ home: string }>(`/api/host-files/${hostId}/home`).then(unwrap),
  });
}

export function useHostFileList(hostId: number, path: string, enabled = true) {
  return useQuery({
    ...hostBrowseQueryOptions(hostId, path),
    enabled: enabled && path !== '',
    placeholderData: keepPreviousData,
  });
}

export function useHostFileContent(hostId: number, path: string, enabled = true) {
  return useQuery({
    queryKey: terminalFileKeys.hostContent(hostId, path),
    queryFn: () => request.get<FileContent>(`/api/host-files/${hostId}/content?path=${encodeURIComponent(path)}`).then(unwrap),
    enabled: enabled && path !== '',
  });
}

export function useHostFileMutation(hostId: number) {
  const qc = useQueryClient();
  const api = `/api/host-files/${hostId}`;
  return useMutation({
    mutationFn: async (
      op:
        | { kind: 'delete'; path: string }
        | { kind: 'rename'; from: string; to: string }
        | { kind: 'create'; path: string; type: 'dir' | 'file' }
        | { kind: 'chmod'; path: string; mode: number }
        | { kind: 'write'; path: string; content: string; baseEtag?: string },
    ) => {
      if (op.kind === 'delete') return request.delete<null>(`${api}/entry?path=${encodeURIComponent(op.path)}`).then(unwrap);
      if (op.kind === 'rename') return request.post<SftpEntry>(`${api}/rename`, { from: op.from, to: op.to }).then(unwrap);
      if (op.kind === 'chmod') return request.post<null>(`${api}/chmod`, { path: op.path, mode: op.mode }).then(unwrap);
      if (op.kind === 'write') {
        return request.put<SftpEntry>(`${api}/content`, {
          path: op.path, content: op.content, baseEtag: op.baseEtag,
        }).then(unwrap);
      }
      return request.post<SftpEntry>(`${api}/create`, { path: op.path, type: op.type }).then(unwrap);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: terminalFileKeys.hostBrowsePrefix(hostId) });
      void qc.invalidateQueries({ queryKey: ['terminal-files', 'content', 'host', hostId] });
    },
  });
}

export function useHostFileUpload(hostId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<SftpEntry>(`/api/host-files/${hostId}/upload`, formData, { onProgress }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.hostBrowsePrefix(hostId) }),
  });
}

export const dockerBrowseQueryOptions = (containerId: string, path: string, options?: { silent?: boolean }) => ({
  queryKey: terminalFileKeys.dockerBrowse(containerId, path),
  queryFn: () => request.get<DockerFileEntry[]>(`/api/docker/${containerId}/files?path=${encodeURIComponent(path)}`, { silent: options?.silent }).then(unwrap),
});

export const fileContentQueryOptions = (filePath: string, readUrl: string) => ({
  queryKey: ['terminal-files', 'content', filePath, readUrl] as const,
  queryFn: () => request.get<FileContent | { content: string }>(readUrl).then(unwrap),
});

export function useFileContent(filePath: string, readUrl: string, enabled: boolean) {
  return useQuery({
    ...fileContentQueryOptions(filePath, readUrl),
    enabled,
  });
}

// ── 文件管理器页专用查询 ──────────────────────────────────────────────────────

export function useTerminalRootInfo() {
  return useQuery(rootInfoQueryOptions());
}

/** 目录浏览（keepPreviousData：目录切换保留旧列表避免闪白） */
export function useTerminalFileList(path: string, enabled = true) {
  return useQuery({
    ...localBrowseQueryOptions(path),
    enabled: enabled && path !== '',
    placeholderData: keepPreviousData,
  });
}

/** 文件夹选择器（移动/复制目标）目录浏览，与主列表共享缓存 */
export function useTerminalPickerList(path: string, enabled = true) {
  return useQuery({
    ...localBrowseQueryOptions(path),
    enabled: enabled && path !== '',
  });
}

export function useTerminalChecksum(path: string | undefined, algo: 'md5' | 'sha1' | 'sha256' | undefined, enabled = true) {
  return useQuery({
    queryKey: terminalFileKeys.checksum(path, algo),
    queryFn: () =>
      request
        .get<{ algo: string; hash: string; size: number }>(`/api/terminal-files/checksum${toQueryString({ path, algo })}`)
        .then(unwrap),
    enabled: enabled && path !== undefined && algo !== undefined,
    // 文件内容随时可能变化，每次打开都重新计算
    staleTime: 0,
  });
}

export interface DirSizeInfo { size: number; files: number; dirs: number; truncated: boolean }

/** 目录大小统计（递归遍历，服务端可能截断，见 truncated 标记；每次按需重新计算） */
export function useTerminalDirSize(path: string | undefined, enabled = true) {
  return useQuery({
    queryKey: terminalFileKeys.dirSize(path),
    queryFn: () => request.get<DirSizeInfo>(`/api/terminal-files/dir-size${toQueryString({ path })}`).then(unwrap),
    enabled: enabled && path !== undefined,
    staleTime: 0,
  });
}

/** 递归深度搜索（按需触发，keyword 为空不发请求；每次搜索都要新鲜结果，不走 staleTime） */
export function useTerminalSearch(dir: string, keyword: string, enabled = true) {
  return useQuery({
    queryKey: terminalFileKeys.search(dir, keyword),
    queryFn: () => request.get<FileSearchResult>(`/api/terminal-files/search${toQueryString({ dir, keyword })}`).then(unwrap),
    enabled: enabled && keyword.trim() !== '',
    staleTime: 0,
  });
}

/**
 * 通用文件操作（rename/create/move/copy/compress/extract/chmod）。
 * endpoint 为 `/api/terminal-files/` 下的操作端点，成功后失效所有目录浏览缓存
 * （操作可能跨目录，如 move/copy，无法精确到单目录）。
 */
export function useTerminalFileOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ endpoint, values }: { endpoint: string; values: Record<string, unknown> }) =>
      request.post<null>(endpoint, values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.localBrowsePrefix }),
  });
}

/** 批量删除条目（逐个串行删除，任一失败即中断抛出） */
export function useDeleteTerminalEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paths: string[]) => {
      for (const path of paths) {
        await request.delete<null>(`/api/terminal-files/entry${toQueryString({ path })}`).then(unwrap);
      }
      return paths.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.localBrowsePrefix }),
  });
}

export async function fetchLocalDir(qc: QueryClient, path: string, options?: { silent?: boolean }) {
  return qc.fetchQuery(localBrowseQueryOptions(path, options));
}

export async function fetchSftpDir(qc: QueryClient, profileId: number, path: string, options?: { silent?: boolean }) {
  return qc.fetchQuery(sftpBrowseQueryOptions(profileId, path, options));
}

export async function fetchDockerDir(qc: QueryClient, containerId: string, path: string, options?: { silent?: boolean }) {
  return qc.fetchQuery(dockerBrowseQueryOptions(containerId, path, options));
}

export function useSaveFileContent(filePath: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, body }: { url: string; body: Record<string, string> }) => request.put<FileContent>(url, body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terminal-files', 'content', filePath] }),
  });
}

/**
 * 压缩 / 解压：服务端改为提交异步任务，返回任务记录。
 * 任务进度与取消由任务托盘统一承载，页面只需提示「已提交」。
 */
export function useTerminalArchiveTask(kind: 'compress' | 'extract') {
  return useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      request.post<AsyncTask>(`/api/terminal-files/${kind}`, values).then(unwrap),
  });
}

/** 轮询等待任务进入终态；用于「打包后立即下载」这类必须等结果的串联流程 */
export async function waitForAsyncTask(taskId: number, options: { intervalMs?: number; timeoutMs?: number } = {}) {
  const intervalMs = options.intervalMs ?? 1000;
  const deadline = Date.now() + (options.timeoutMs ?? 10 * 60_000);
  for (;;) {
    const task = await request.get<AsyncTask>(`/api/async-tasks/${taskId}`, { silent: true }).then(unwrap);
    if (task.status !== 'pending' && task.status !== 'running') return task;
    if (Date.now() > deadline) throw new Error('任务执行超时');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function useLocalFileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: { kind: 'delete'; path: string } | { kind: 'rename'; from: string; to: string } | { kind: 'create'; path: string; type: 'dir' | 'file' }) => {
      if (op.kind === 'delete') return request.delete<null>(`/api/terminal-files/entry?path=${encodeURIComponent(op.path)}`).then(unwrap);
      if (op.kind === 'rename') return request.post<null>('/api/terminal-files/rename', { from: op.from, to: op.to }).then(unwrap);
      return request.post<FsEntry>('/api/terminal-files/create', { path: op.path, type: op.type }).then(unwrap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.localBrowsePrefix }),
  });
}

export function useLocalFileUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress, silent }: { formData: FormData; onProgress?: (percent: number) => void; silent?: boolean }) =>
      request.postForm<FsEntry>('/api/terminal-files/upload', formData, { onProgress, silent }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.localBrowsePrefix }),
  });
}

export function useSftpFileMutation(profileId: number) {
  const qc = useQueryClient();
  const api = `/api/ssh-sftp/${profileId}`;
  return useMutation({
    mutationFn: async (
      op:
        | { kind: 'delete'; path: string }
        | { kind: 'rename'; from: string; to: string }
        | { kind: 'create'; path: string; type: 'dir' | 'file' }
        | { kind: 'chmod'; path: string; mode: number },
    ) => {
      if (op.kind === 'delete') return request.delete<null>(`${api}/entry?path=${encodeURIComponent(op.path)}`).then(unwrap);
      if (op.kind === 'rename') return request.post<null>(`${api}/rename`, { from: op.from, to: op.to }).then(unwrap);
      if (op.kind === 'chmod') return request.post<null>(`${api}/chmod`, { path: op.path, mode: op.mode }).then(unwrap);
      return request.post<SftpEntry>(`${api}/create`, { path: op.path, type: op.type }).then(unwrap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: terminalFileKeys.sftpBrowsePrefix(profileId) }),
  });
}

export function useDockerExplorerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) =>
      request.post<null>(`/api/docker/${id}/${action}`, {}).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dockerKeys.all });
      void qc.invalidateQueries({ queryKey: terminalFileKeys.all });
    },
  });
}
