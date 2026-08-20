import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Dropdown, Input, InputNumber, Popover, Select, Spin, Tag, Toast, Tooltip, Typography } from '@douyinfe/semi-ui';
import { Icon } from '@iconify/react';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, CaseSensitive, Copy, Download, FileDown, FileText, Hash,
  ListFilter, ListOrdered, MoreHorizontal, Pause, Play, RefreshCw, Regex, Search, StopCircle, Trash2, WrapText,
} from 'lucide-react';
import { MasterDetailLayout } from '@/components/MasterDetailLayout';
import { NavListPanel, NavListItem } from '@/components/NavListPanel';
import { request } from '@/utils/request';
import { formatDateTime } from '@/utils/date';
import { formatFileSize } from '@/utils/file-utils';
import { usePermission } from '@/hooks/usePermission';
import { useUrlSelectionState } from '@/hooks/useUrlSelectionState';
import { config } from '@/config';
import { TOKEN_KEY } from '@zenith/shared/core';
import { type LogFile, useDeleteLogFile, useLogFileContent, useLogFiles } from '@/hooks/queries/log-files';
import { confirmDelete } from '@/utils/confirm';
import { buildSearchIndex, compileSearchPattern, computeEffectiveLevels, type LogLevel, type MatchRange, type SearchMatch } from './logFilesSearch';
import { LogContentView, type LogContentViewHandle } from './LogContentView';

const EMPTY_LOG_FILES: LogFile[] = [];
const EMPTY_LINES: string[] = [];
const MAX_TAIL_LINES = 5000;
const TAIL_RETRY_LIMIT = 3;
const TAIL_RETRY_DELAY_MS = 1500;

const LEVEL_FILTER_VALUES: Array<{ value: 'all' | LogLevel; label: string }> = [
  { value: 'all', label: '全部级别' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
];

const LINE_COUNT_OPTIONS = [500, 1000, 2000, 5000].map((n) => ({ value: n, label: `最后 ${n} 行` }));

const CONTEXT_OPTIONS = [0, 2, 5, 10].map((n) => ({ value: n, label: n === 0 ? '无上下文' : `上下文 ±${n} 行` }));

/** 显示偏好持久化到 localStorage */
function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return initialValue;
  });
  const set = useCallback((next: SetStateAction<T>) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch { /* ignore */ }
      return resolved;
    });
  }, [key]);
  return [value, set] as const;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** 复制文本：优先 Clipboard API，失败回退隐藏 textarea + execCommand（无剪贴板权限的宿主环境） */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 打开 tail SSE 连接；401 时借助统一请求层触发 token 刷新后重试一次 */async function fetchTailStream(fileName: string, signal: AbortSignal): Promise<Response> {
  const doFetch = () => fetch(`${config.apiBaseUrl}/api/log-files/${encodeURIComponent(fileName)}/tail`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
    signal,
  });
  let res = await doFetch();
  if (res.status === 401) {
    await request.get('/api/log-files', { silent: true });
    res = await doFetch();
  }
  return res;
}

/** 读取 SSE 流，按 chunk 批量回调（而非逐行 setState） */
async function readTailStream(res: Response, onBatch: (batch: string[]) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    const batch: string[] = [];
    for (const part of parts) {
      if (part.startsWith('data:')) {
        const line = part.slice(5).trimStart();
        if (line) batch.push(line);
      }
    }
    if (batch.length > 0) onBatch(batch);
  }
}

export default function LogFilesPage() {
  const { hasPermission } = usePermission();
  const [keyword, setKeyword] = useState('');
  // 选中文件以 `?file=` 同步到 URL（刷新/分享链接/告警事件跳转直达）；选中对象按文件名派生
  const [selectedFileKey, setSelectedFileKey] = useUrlSelectionState('file');
  // ?level= 等伴随参数仍直接读取
  const [searchParams] = useSearchParams();

  // 内容搜索：输入即时高亮（防抖），全文模式回车提交服务端过滤
  const [searchDraft, setSearchDraft] = useState('');
  const debouncedSearch = useDebouncedValue(searchDraft.trim(), 250);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  /** 仅显示匹配行（grep 模式） */
  const [matchesOnly, setMatchesOnly] = useState(false);
  const [fullText, setFullText] = useState(false);
  const [serverKeyword, setServerKeyword] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all');

  // 显示偏好（持久化）
  const [showLineNumbers, setShowLineNumbers] = usePersistentState('logFiles.lineNumbers', true);
  const [wrap, setWrap] = usePersistentState('logFiles.wrap', true);
  const [lineCount, setLineCount] = usePersistentState('logFiles.lineCount', 5000);
  const [serverContext, setServerContext] = usePersistentState('logFiles.context', 0);

  // 实时追踪
  const [tailing, setTailing] = useState(false);
  const [tailLines, setTailLines] = useState<string[]>([]);
  const tailAbortRef = useRef<AbortController | null>(null);
  const [tailPaused, setTailPaused] = useState(false);
  const tailPausedRef = useRef(false);
  const pendingTailRef = useRef<string[]>([]);
  const [pendingTailCount, setPendingTailCount] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);

  // 跳到行号
  const contentViewRef = useRef<LogContentViewHandle | null>(null);
  const [gotoValue, setGotoValue] = useState<number | null>(null);

  const filesQuery = useLogFiles();
  const files = filesQuery.data ?? EMPTY_LOG_FILES;
  const selected = useMemo(
    () => (selectedFileKey ? files.find((f) => f.name === selectedFileKey) ?? null : null),
    [files, selectedFileKey],
  );
  const deleteMutation = useDeleteLogFile();

  const contentParams = useMemo(
    () => ({
      lines: lineCount,
      keyword: fullText && serverKeyword ? serverKeyword : undefined,
      context: fullText && serverKeyword && serverContext > 0 ? serverContext : undefined,
    }),
    [lineCount, fullText, serverKeyword, serverContext],
  );
  const contentQuery = useLogFileContent(selected?.name, contentParams, !!selected && !tailing);
  const refetchContent = contentQuery.refetch;

  const filteredFiles = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return files;
    return files.filter((file) => file.name.toLowerCase().includes(normalizedKeyword));
  }, [files, keyword]);

  // ── 派生数据：级别过滤（base 层）→ 搜索索引 → grep 模式（display 层） ──
  const rawLines = tailing ? tailLines : (contentQuery.data?.lines ?? EMPTY_LINES);
  const levels = useMemo(() => computeEffectiveLevels(rawLines), [rawLines]);

  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    for (const level of levels) {
      if (level) counts[level] += 1;
    }
    return counts;
  }, [levels]);
  const levelOptions = useMemo(
    () => LEVEL_FILTER_VALUES.map(({ value, label }) => ({
      value,
      label: value === 'all' ? `${label} (${rawLines.length})` : `${label} (${levelCounts[value]})`,
    })),
    [levelCounts, rawLines.length],
  );

  const baseIndexes = useMemo(() => {
    if (levelFilter === 'all') return rawLines.map((_, i) => i);
    const out: number[] = [];
    levels.forEach((level, i) => {
      if (level === levelFilter) out.push(i);
    });
    return out;
  }, [rawLines, levels, levelFilter]);
  const baseLines = useMemo(
    () => (levelFilter === 'all' ? rawLines : baseIndexes.map((i) => rawLines[i])),
    [levelFilter, rawLines, baseIndexes],
  );

  const searchPattern = useMemo(
    () => compileSearchPattern(debouncedSearch, { regex: searchRegex, caseSensitive: searchCaseSensitive }),
    [debouncedSearch, searchRegex, searchCaseSensitive],
  );
  const searchInvalid = searchRegex && debouncedSearch !== '' && searchPattern === null;
  const searchIndex = useMemo(() => buildSearchIndex(baseLines, searchPattern), [baseLines, searchPattern]);

  const grepActive = matchesOnly && searchPattern !== null;
  const { displayIndexes, displayLines, displayRanges, displayMatches } = useMemo(() => {
    if (!grepActive) {
      return {
        displayIndexes: baseIndexes,
        displayLines: baseLines,
        displayRanges: searchIndex.lineRanges,
        displayMatches: searchIndex.matches,
      };
    }
    // 仅保留匹配行，并把 base 下标重映射为紧凑的展示下标
    const matchedBase = [...searchIndex.lineRanges.keys()].sort((a, b) => a - b);
    const baseToDisplay = new Map(matchedBase.map((b, i) => [b, i]));
    const ranges = new Map<number, MatchRange[]>();
    matchedBase.forEach((b, i) => {
      const r = searchIndex.lineRanges.get(b);
      if (r) ranges.set(i, r);
    });
    return {
      displayIndexes: matchedBase.map((b) => baseIndexes[b]),
      displayLines: matchedBase.map((b) => baseLines[b]),
      displayRanges: ranges,
      displayMatches: searchIndex.matches.map((m): SearchMatch => ({ ...m, lineIndex: baseToDisplay.get(m.lineIndex) ?? 0 })),
    };
  }, [grepActive, baseIndexes, baseLines, searchIndex]);

  const matches = displayMatches;
  const safeMatchIndex = matches.length === 0 ? 0 : Math.min(activeMatchIndex, matches.length - 1);
  const activeMatch = matches[safeMatchIndex] ?? null;

  // ── 实时追踪 ──
  const resetTailPause = useCallback(() => {
    tailPausedRef.current = false;
    setTailPaused(false);
    pendingTailRef.current = [];
    setPendingTailCount(0);
  }, []);

  const abortTail = useCallback(() => {
    tailAbortRef.current?.abort();
    tailAbortRef.current = null;
    setTailing(false);
    setReconnecting(false);
    resetTailPause();
  }, [resetTailPause]);

  const stopTail = useCallback(() => {
    const wasTailing = tailAbortRef.current !== null;
    abortTail();
    // 停止追踪后回源拉最新静态内容（refetch 可绕过 enabled）
    if (wasTailing) void refetchContent();
  }, [abortTail, refetchContent]);

  useEffect(() => () => {
    tailAbortRef.current?.abort();
  }, []);

  const appendTailLines = useCallback((batch: string[]) => {
    setTailLines((prev) => (prev.length + batch.length > MAX_TAIL_LINES
      ? [...prev, ...batch].slice(-MAX_TAIL_LINES)
      : [...prev, ...batch]));
  }, []);

  const pauseTail = useCallback(() => {
    tailPausedRef.current = true;
    setTailPaused(true);
  }, []);

  const resumeTail = useCallback(() => {
    tailPausedRef.current = false;
    setTailPaused(false);
    const pending = pendingTailRef.current;
    pendingTailRef.current = [];
    setPendingTailCount(0);
    if (pending.length > 0) appendTailLines(pending);
  }, [appendTailLines]);

  const toggleTail = async () => {
    if (tailing) {
      stopTail();
      return;
    }
    if (!selected) return;

    const fileName = selected.name;
    const ctrl = new AbortController();
    tailAbortRef.current = ctrl;
    setTailing(true);
    setTailLines([]);
    setServerKeyword('');
    resetTailPause();
    setReconnecting(false);

    const appendBatch = (batch: string[]) => {
      // 暂停期间进积压缓冲（同样受 MAX_TAIL_LINES 限制），恢复时一次性合并
      if (tailPausedRef.current) {
        pendingTailRef.current = [...pendingTailRef.current, ...batch].slice(-MAX_TAIL_LINES);
        setPendingTailCount(pendingTailRef.current.length);
        return;
      }
      appendTailLines(batch);
    };

    let failures = 0;
    try {
      // 断线自动重连：收到数据即清零计数，连续失败达到上限才停止
      while (!ctrl.signal.aborted) {
        let gotData = false;
        try {
          const res = await fetchTailStream(fileName, ctrl.signal);
          if (res.ok && res.body) {
            setReconnecting(false);
            await readTailStream(res, (batch) => {
              gotData = true;
              appendBatch(batch);
            });
          }
        } catch (e: unknown) {
          if (ctrl.signal.aborted || (e instanceof Error && e.name === 'AbortError')) return;
        }
        if (ctrl.signal.aborted) return;
        failures = gotData ? 0 : failures + 1;
        if (failures >= TAIL_RETRY_LIMIT) {
          Toast.error('实时追踪连接中断，已停止');
          return;
        }
        setReconnecting(true);
        await new Promise((resolve) => setTimeout(resolve, TAIL_RETRY_DELAY_MS));
      }
    } finally {
      if (tailAbortRef.current === ctrl) {
        tailAbortRef.current = null;
        setTailing(false);
        setReconnecting(false);
      }
    }
  };

  // ── 交互 ──
  const applyBrowseReset = useCallback(() => {
    abortTail();
    setTailLines([]);
    setSearchDraft('');
    setServerKeyword('');
    setActiveMatchIndex(0);
    setLevelFilter('all');
  }, [abortTail]);

  const appliedFileParamRef = useRef<string | null>(null);

  const selectFile = useCallback((file: LogFile) => {
    if (selected?.name === file.name) return;
    // 点选路径在此登记，深链 effect 不再重复应用
    appliedFileParamRef.current = file.name;
    applyBrowseReset();
    setSelectedFileKey(file.name);
  }, [selected, applyBrowseReset, setSelectedFileKey]);

  // URL ?file= 深链：文件列表就绪后应用（刷新/分享链接/告警事件跳转直达）。
  // 页面可能被页签缓存复用，因此按参数值追踪而非只应用一次；
  // 当天文件已轮转归档时回退到 .gz 并改写参数，落定后仍不存在则清参；
  // ?level= 指定初始级别过滤（告警跳转带 error/warn）
  useEffect(() => {
    if (!selectedFileKey) {
      if (appliedFileParamRef.current !== null) {
        // URL 驱动的取消选中（如浏览器后退）：停掉残留的实时追踪
        appliedFileParamRef.current = null;
        abortTail();
        setTailLines([]);
      }
      return;
    }
    if (files.length === 0) return;
    if (appliedFileParamRef.current === selectedFileKey) return;
    const target = files.find((f) => f.name === selectedFileKey)
      ?? files.find((f) => f.name === `${selectedFileKey}.gz`);
    if (!target) {
      if (!filesQuery.isFetching) setSelectedFileKey(null);
      return;
    }
    if (target.name !== selectedFileKey) {
      setSelectedFileKey(target.name);
      return;
    }
    appliedFileParamRef.current = target.name;
    // URL 驱动的选中（非点选路径）：重置浏览状态并应用伴随级别参数
    applyBrowseReset();
    const levelParam = searchParams.get('level');
    if (levelParam === 'error' || levelParam === 'warn' || levelParam === 'info' || levelParam === 'debug') {
      // applyBrowseReset 重置为 all，同一批 state 更新中后写的生效
      setLevelFilter(levelParam);
    }
  }, [files, filesQuery.isFetching, selectedFileKey, setSelectedFileKey, searchParams, applyBrowseReset, abortTail]);

  const jumpToMatch = useCallback((direction: -1 | 1) => {
    if (matches.length === 0 || (tailing && !tailPaused)) return;
    setActiveMatchIndex((prev) => {
      const current = Math.min(prev, matches.length - 1);
      return (current + direction + matches.length) % matches.length;
    });
  }, [matches.length, tailing, tailPaused]);

  const handleSearchChange = (value: string) => {
    setSearchDraft(value);
    setActiveMatchIndex(0);
    if (!value.trim() && serverKeyword) setServerKeyword('');
  };

  const handleSearchEnter = (e: ReactKeyboardEvent) => {
    if (fullText) {
      setServerKeyword(searchDraft.trim());
      setActiveMatchIndex(0);
      return;
    }
    jumpToMatch(e.shiftKey ? -1 : 1);
  };

  const toggleFullText = () => {
    setFullText((prev) => {
      const next = !prev;
      if (!next) setServerKeyword('');
      else if (searchDraft.trim()) setServerKeyword(searchDraft.trim());
      return next;
    });
  };

  const handleDownload = async (file: LogFile) => {
    try {
      await request.download(`/api/log-files/${encodeURIComponent(file.name)}/download`, file.name);
    } catch {
      Toast.error('下载失败');
    }
  };

  const deselectFile = useCallback(() => {
    appliedFileParamRef.current = null;
    abortTail();
    setTailLines([]);
    setSelectedFileKey(null);
  }, [abortTail, setSelectedFileKey]);

  const handleDelete = (file: LogFile) => {
    confirmDelete({
      title: `确定要删除 ${file.name} 吗？`,
      content: '删除后无法恢复，请谨慎操作。',
      onOk: async () => {
        await deleteMutation.mutateAsync(file.name);
        Toast.success('删除成功');
        if (selected?.name === file.name) deselectFile();
      },
    });
  };

  const gzFiles = useMemo(() => files.filter((f) => f.isGzip), [files]);

  const handleCleanGz = () => {
    if (gzFiles.length === 0) return;
    const totalSize = gzFiles.reduce((sum, f) => sum + f.size, 0);
    confirmDelete({
      title: '确定要清理全部压缩日志吗？',
      content: `共 ${gzFiles.length} 个 .gz 文件（${formatFileSize(totalSize)}），删除后无法恢复。`,
      onOk: async () => {
        for (const file of gzFiles) {
          await deleteMutation.mutateAsync(file.name);
        }
        Toast.success(`已清理 ${gzFiles.length} 个压缩日志`);
        if (selected?.isGzip) deselectFile();
      },
    });
  };

  // ── 复制 / 导出 ──
  const handleCopy = async (mode: 'view' | 'all') => {
    const source = mode === 'all' ? rawLines : displayLines;
    if (source.length === 0) {
      Toast.info('没有可复制的内容');
      return;
    }
    if (await copyText(source.join('\n'))) {
      Toast.success(`已复制 ${source.length} 行`);
    } else {
      Toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const handleExportView = () => {
    if (displayLines.length === 0) {
      Toast.info('没有可导出的内容');
      return;
    }
    const blob = new Blob([displayLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selected?.name ?? 'log').replace(/\.log(\.gz)?$/, '')}-filtered.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGotoLine = () => {
    if (!gotoValue || rawLines.length === 0) return;
    contentViewRef.current?.scrollToOriginalLine(Math.min(Math.max(1, gotoValue), rawLines.length));
  };

  const contentLoading = !tailing && contentQuery.isFetching && !contentQuery.data;
  const contentError = !tailing && contentQuery.isError;
  const resetKey = `${selected?.name ?? ''}|${tailing ? 'tail' : 'static'}|${contentQuery.dataUpdatedAt}`;
  let emptyText: string;
  if (tailing) {
    emptyText = '等待日志输出…';
  } else if (rawLines.length > 0 && grepActive) {
    emptyText = '无匹配行';
  } else if (rawLines.length > 0 && levelFilter !== 'all') {
    emptyText = '当前级别下无日志';
  } else if (fullText && serverKeyword) {
    emptyText = '未找到匹配的日志内容';
  } else {
    emptyText = '（文件为空）';
  }

  const matchCounter = debouncedSearch ? (
    <span
      style={{
        fontSize: 11,
        color: 'var(--semi-color-text-2)',
        padding: '0 6px',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {matches.length === 0 ? '0/0' : `${safeMatchIndex + 1}/${matches.length}`}
    </span>
  ) : undefined;

  return (
    <MasterDetailLayout
      defaultSize={260}
      minSize={200}
      maxSize={480}
      persistKey="log-files"
      showDetail={selected !== null}
      onBack={deselectFile}
      master={(
          <NavListPanel
            title="日志文件"
            headerExtra={
              <>
                <Button
                  icon={<RefreshCw size={13} />}
                  size="small"
                  theme="borderless"
                  loading={filesQuery.isFetching}
                  onClick={() => void filesQuery.refetch()}
                />
                {hasPermission('system:log:files:delete') && (
                  <Dropdown
                    trigger="click"
                    position="bottomRight"
                    clickToHide
                    render={
                      <Dropdown.Menu>
                        <Dropdown.Item
                          type="danger"
                          disabled={gzFiles.length === 0}
                          onClick={handleCleanGz}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Trash2 size={14} /> 清理压缩日志（{gzFiles.length} 个）
                          </span>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    }
                  >
                    <Button theme="borderless" size="small" icon={<MoreHorizontal size={14} />} />
                  </Dropdown>
                )}
              </>
            }
            search={{
              value: keyword,
              onChange: (value) => setKeyword(value),
              placeholder: '搜索文件名',
            }}
            loading={filesQuery.isFetching}
            emptyText={files.length === 0 ? '暂无日志文件' : '未找到匹配的日志文件'}
            dataSource={filteredFiles}
            renderItem={(file) => {
              const active = selected?.name === file.name;
              return (
                <NavListItem
                  key={file.name}
                  active={active}
                  onClick={() => selectFile(file)}
                  icon={<Icon icon="vscode-icons:file-type-log" width={13} height={13} />}
                  primary={file.name}
                  meta={
                    <>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 4px',
                        borderRadius: 'var(--semi-border-radius-small)',
                        lineHeight: '14px',
                        background: file.isGzip ? 'var(--semi-color-fill-2)' : 'var(--semi-color-primary-light-default)',
                        color: file.isGzip ? 'var(--semi-color-text-2)' : 'var(--semi-color-primary)',
                      }}>
                        {file.isGzip ? 'gz' : 'log'}
                      </span>
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDateTime(file.modifiedAt)}</span>
                    </>
                  }
                  extra={
                    <Dropdown
                      trigger="click"
                      position="bottomRight"
                      clickToHide
                      render={
                        <Dropdown.Menu>
                          {hasPermission('system:log:files:download') && (
                            <Dropdown.Item onClick={() => void handleDownload(file)}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Download size={14} /> 下载
                              </span>
                            </Dropdown.Item>
                          )}
                          {hasPermission('system:log:files:delete') && (
                            <Dropdown.Item
                              type="danger"
                              onClick={() => handleDelete(file)}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Trash2 size={14} /> 删除
                              </span>
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      }
                    >
                      <Button
                        theme="borderless"
                        size="small"
                        icon={<MoreHorizontal size={14} />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  }
                />
              );
            }}
          />
      )}
      detail={(
        <>
          {selected ? (
            <>
            {/* 顶部工具栏 */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--semi-color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <Icon icon="vscode-icons:file-type-log" width={14} height={14} style={{ flexShrink: 0 }} />
              <Typography.Text style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>
                {selected.name}
              </Typography.Text>
              {tailing && !tailPaused && (
                <Tag color="green" size="small">
                  <Activity size={10} style={{ marginRight: 4 }} />实时追踪中
                </Tag>
              )}
              {tailing && tailPaused && (
                <Tag color="orange" size="small">
                  <Pause size={10} style={{ marginRight: 4 }} />
                  已暂停{pendingTailCount > 0 ? ` · 积压 ${pendingTailCount} 行` : ''}
                </Tag>
              )}
              {tailing && reconnecting && (
                <Tag color="red" size="small">连接中断，重连中…</Tag>
              )}
              {tailing && tailLines.length >= MAX_TAIL_LINES && (
                <Tag color="orange" size="small">仅保留最近 {MAX_TAIL_LINES} 行</Tag>
              )}
              {!tailing && fullText && serverKeyword && (
                <Tag color="purple" size="small" closable onClose={() => setServerKeyword('')}>
                  全文过滤：{serverKeyword}
                </Tag>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Input
                  prefix={<Search size={14} />}
                  suffix={matchCounter}
                  placeholder={fullText ? '全文搜索，回车提交' : '搜索日志内容'}
                  value={searchDraft}
                  onChange={handleSearchChange}
                  onEnterPress={handleSearchEnter}
                  showClear
                  size="small"
                  validateStatus={searchInvalid ? 'error' : 'default'}
                  style={{ width: 240 }}
                />
                <Tooltip content={searchInvalid ? '正则表达式无效' : '按正则表达式搜索'}>
                  <Button
                    size="small"
                    theme={searchRegex ? 'light' : 'borderless'}
                    type={searchInvalid ? 'danger' : searchRegex ? 'primary' : 'tertiary'}
                    icon={<Regex size={13} />}
                    onClick={() => { setSearchRegex((v) => !v); setActiveMatchIndex(0); }}
                  />
                </Tooltip>
                <Tooltip content="区分大小写">
                  <Button
                    size="small"
                    theme={searchCaseSensitive ? 'light' : 'borderless'}
                    type={searchCaseSensitive ? 'primary' : 'tertiary'}
                    icon={<CaseSensitive size={15} />}
                    onClick={() => { setSearchCaseSensitive((v) => !v); setActiveMatchIndex(0); }}
                  />
                </Tooltip>
                <Tooltip content="仅显示匹配行（grep 模式）">
                  <Button
                    size="small"
                    theme={matchesOnly ? 'light' : 'borderless'}
                    type={matchesOnly ? 'primary' : 'tertiary'}
                    icon={<ListFilter size={13} />}
                    onClick={() => { setMatchesOnly((v) => !v); setActiveMatchIndex(0); }}
                  />
                </Tooltip>
                <Tooltip content="上一个匹配（Shift+Enter）">
                  <Button
                    size="small"
                    theme="borderless"
                    icon={<ArrowUp size={13} />}
                    disabled={matches.length === 0 || (tailing && !tailPaused)}
                    onClick={() => jumpToMatch(-1)}
                  />
                </Tooltip>
                <Tooltip content="下一个匹配（Enter）">
                  <Button
                    size="small"
                    theme="borderless"
                    icon={<ArrowDown size={13} />}
                    disabled={matches.length === 0 || (tailing && !tailPaused)}
                    onClick={() => jumpToMatch(1)}
                  />
                </Tooltip>
                <Tooltip content="全文搜索：按关键词过滤整个文件（服务端），回车提交">
                  <Button
                    size="small"
                    theme={fullText ? 'solid' : 'borderless'}
                    type={fullText ? 'primary' : 'tertiary'}
                    disabled={tailing}
                    onClick={toggleFullText}
                  >
                    全文
                  </Button>
                </Tooltip>
                {fullText && (
                  <Select
                    size="small"
                    value={serverContext}
                    onChange={(value) => setServerContext(value as number)}
                    optionList={CONTEXT_OPTIONS}
                    disabled={tailing}
                    style={{ width: 128 }}
                  />
                )}
                <Select
                  size="small"
                  value={levelFilter}
                  onChange={(value) => { setLevelFilter(value as 'all' | LogLevel); setActiveMatchIndex(0); }}
                  optionList={levelOptions}
                  style={{ width: 132 }}
                />
                <Select
                  size="small"
                  value={lineCount}
                  onChange={(value) => setLineCount(value as number)}
                  optionList={LINE_COUNT_OPTIONS}
                  disabled={tailing}
                  style={{ width: 122 }}
                />
                {!selected.isGzip && hasPermission('system:log:files') && (
                  tailing ? (
                    <>
                      <Button
                        size="small"
                        icon={tailPaused ? <Play size={13} /> : <Pause size={13} />}
                        theme="light"
                        onClick={() => (tailPaused ? resumeTail() : pauseTail())}
                      >
                        {tailPaused ? '继续' : '暂停'}
                      </Button>
                      <Button
                        size="small"
                        icon={<StopCircle size={13} />}
                        type="danger"
                        theme="light"
                        onClick={() => void toggleTail()}
                      >
                        停止
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="small"
                      icon={<Activity size={13} />}
                      type="primary"
                      theme="light"
                      onClick={() => void toggleTail()}
                    >
                      实时追踪
                    </Button>
                  )
                )}
                <Popover
                  trigger="click"
                  position="bottomRight"
                  content={
                    <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <InputNumber
                        size="small"
                        min={1}
                        max={Math.max(1, rawLines.length)}
                        value={gotoValue ?? undefined}
                        onChange={(v) => setGotoValue(Number(v) || null)}
                        placeholder="行号"
                        style={{ width: 110 }}
                      />
                      <Button size="small" theme="solid" type="primary" disabled={!gotoValue} onClick={handleGotoLine}>
                        跳转
                      </Button>
                    </div>
                  }
                >
                  <span style={{ display: 'inline-flex' }}>
                    <Tooltip content="跳到行号">
                      <Button size="small" theme="borderless" icon={<Hash size={13} />} disabled={rawLines.length === 0} />
                    </Tooltip>
                  </span>
                </Popover>
                <Dropdown
                  trigger="click"
                  position="bottomRight"
                  clickToHide
                  render={
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => void handleCopy('view')}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Copy size={14} /> 复制当前视图（{displayLines.length} 行）
                        </span>
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => void handleCopy('all')}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Copy size={14} /> 复制全部（{rawLines.length} 行）
                        </span>
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleExportView}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileDown size={14} /> 导出当前视图为 txt
                        </span>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  }
                >
                  <span style={{ display: 'inline-flex' }}>
                    <Tooltip content="复制 / 导出">
                      <Button size="small" theme="borderless" icon={<Copy size={13} />} disabled={rawLines.length === 0} />
                    </Tooltip>
                  </span>
                </Dropdown>
                <Tooltip content={showLineNumbers ? '隐藏行号' : '显示行号'}>
                  <Button
                    size="small"
                    theme={showLineNumbers ? 'light' : 'borderless'}
                    type={showLineNumbers ? 'primary' : 'tertiary'}
                    icon={<ListOrdered size={13} />}
                    onClick={() => setShowLineNumbers((v) => !v)}
                  />
                </Tooltip>
                <Tooltip content={wrap ? '关闭自动换行' : '开启自动换行'}>
                  <Button
                    size="small"
                    theme={wrap ? 'light' : 'borderless'}
                    type={wrap ? 'primary' : 'tertiary'}
                    icon={<WrapText size={13} />}
                    onClick={() => setWrap((v) => !v)}
                  />
                </Tooltip>
                {hasPermission('system:log:files') && (
                  <Tooltip content="刷新">
                    <Button
                      size="small"
                      theme="borderless"
                      icon={<RefreshCw size={13} />}
                      loading={!tailing && contentQuery.isFetching}
                      disabled={tailing}
                      onClick={() => void refetchContent()}
                    />
                  </Tooltip>
                )}
                {hasPermission('system:log:files:download') && (
                  <Tooltip content="下载">
                    <Button
                      size="small"
                      theme="borderless"
                      icon={<Download size={13} />}
                      onClick={() => void handleDownload(selected)}
                    />
                  </Tooltip>
                )}
                {hasPermission('system:log:files:delete') && (
                  <Tooltip content="删除">
                    <Button
                      size="small"
                      theme="borderless"
                      type="danger"
                      icon={<Trash2 size={13} />}
                      onClick={() => handleDelete(selected)}
                    />
                  </Tooltip>
                )}
              </div>
            </div>

            {/* 日志内容 */}
            {contentError ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <AlertTriangle size={32} style={{ color: 'var(--semi-color-danger)' }} />
                <Typography.Text type="tertiary">日志内容加载失败</Typography.Text>
                <Button size="small" theme="light" type="primary" icon={<RefreshCw size={13} />} onClick={() => void refetchContent()}>
                  重试
                </Button>
              </div>
            ) : contentLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" />
              </div>
            ) : (
              <LogContentView
                ref={contentViewRef}
                lines={rawLines}
                visibleIndexes={displayIndexes}
                levels={levels}
                lineRanges={displayRanges}
                activeMatch={activeMatch}
                showLineNumbers={showLineNumbers}
                wrap={wrap}
                following={tailing && !tailPaused}
                resetKey={resetKey}
                emptyText={emptyText}
              />
            )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FileText size={40} style={{ color: 'var(--semi-color-text-3)' }} />
              <Typography.Text type="tertiary">请从左侧选择一个日志文件查看</Typography.Text>
            </div>
          )}
        </>
      )}
    />
  );
}
