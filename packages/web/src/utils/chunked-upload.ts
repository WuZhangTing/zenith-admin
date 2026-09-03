/**
 * 分片上传 + 断点续传工具。
 * 大文件切片并发上传，失败分片自动重试；uploadId 持久化到 localStorage，
 * 支持刷新/重新选择同一文件后续传未完成的分片。
 */
import { request } from '@/utils/request';

/** 默认分片大小：5MB。超过该大小的文件走分片上传。 */
export const CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNK_CONCURRENCY = 3;
const MAX_RETRY = 3;
const RESUME_KEY_PREFIX = 'zenith_chunk_upload:';

export interface ChunkedUploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function resumeKey(file: File) {
  return `${RESUME_KEY_PREFIX}${file.name}:${file.size}:${file.lastModified}`;
}

/** 对单个文件执行分片上传，返回最终的 ManagedFile（data）。 */
export async function chunkedUpload<TFile = unknown>(file: File, opts: ChunkedUploadOptions): Promise<TFile> {
  const { signal } = opts;

  let uploadId = '';
  let chunkSize = CHUNK_SIZE;
  let totalChunks = 0;
  const received = new Set<number>();

  // 1) 尝试续传：localStorage 中已有未完成会话
  const storedId = localStorage.getItem(resumeKey(file));
  if (storedId) {
    try {
      const body = await request.get<{ status: string; chunkSize: number; totalChunks: number; received: number[] }>(`/api/files/upload/${storedId}/status`, { silent: true, signal });
      if (body.code === 0 && body.data.status === 'uploading') {
        uploadId = storedId;
        chunkSize = body.data.chunkSize;
        totalChunks = body.data.totalChunks;
        body.data.received.forEach((i) => received.add(i));
      }
    } catch {
      // 续传探测失败则走全新初始化
    }
  }

  // 2) 初始化
  if (!uploadId) {
    const body = await request.post<{ uploadId: string; chunkSize: number; totalChunks: number; received: number[] }>(
      '/api/files/upload/init',
      { fileName: file.name, fileSize: file.size, mimeType: file.type || undefined, chunkSize: CHUNK_SIZE },
      { silent: true, signal },
    );
    if (body.code !== 0) throw new Error(body.message || '初始化上传失败');
    uploadId = body.data.uploadId;
    chunkSize = body.data.chunkSize;
    totalChunks = body.data.totalChunks;
    body.data.received.forEach((i) => received.add(i));
    localStorage.setItem(resumeKey(file), uploadId);
  }

  // 3) 并发上传缺失分片（失败重试）
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) if (!received.has(i)) missing.push(i);

  let done = received.size;
  const report = () => opts.onProgress?.(totalChunks === 0 ? 100 : Math.min(99, Math.round((done / totalChunks) * 100)));
  report();

  const uploadOne = async (index: number): Promise<void> => {
    const start = index * chunkSize;
    const blob = file.slice(start, Math.min(start + chunkSize, file.size));
    for (let attempt = 0; ; attempt++) {
      try {
        const fd = new FormData();
        fd.append('uploadId', uploadId);
        fd.append('index', String(index));
        fd.append('chunk', blob);
        const body = await request.post<unknown>('/api/files/upload/chunk', fd, { silent: true, signal });
        if (body.code !== 0) throw new Error(body.message || '分片上传失败');
        return;
      } catch (err) {
        if (signal?.aborted || attempt >= MAX_RETRY) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  };

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < missing.length) {
      if (signal?.aborted) throw new Error('已取消');
      const index = missing[cursor++];
      await uploadOne(index);
      done++;
      report();
    }
  };
  const workerCount = Math.min(CHUNK_CONCURRENCY, Math.max(1, missing.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // 4) 合并完成
  const body = await request.post<TFile>('/api/files/upload/complete', { uploadId }, { silent: true, signal });
  if (body.code !== 0) throw new Error(body.message || '合并失败');
  localStorage.removeItem(resumeKey(file));
  opts.onProgress?.(100);
  return body.data;
}
