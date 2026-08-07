import { useMemo } from 'react';
import FileViewer from '@file-viewer/react';
import { archiveRenderer } from '@file-viewer/renderer-archive';
import { presentationRenderer } from '@file-viewer/renderer-presentation';
import archiveWorkerUrl from 'libarchive.js/dist/worker-bundle.js?url';
import archiveWasmUrl from 'libarchive.js/dist/libarchive.wasm?url';
import { configuredFileViewerRenderers } from 'virtual:file-viewer-renderers';
import { useThemeController } from '@/providers/theme-controller';
import type { CSSProperties } from 'react';
import type { ViewerOptions } from '@file-viewer/react';

interface FileViewerPreviewPanelProps {
  readonly file: File;
  readonly style?: CSSProperties;
}

const fileViewerRenderers = [
  ...(Array.isArray(configuredFileViewerRenderers)
    ? configuredFileViewerRenderers
    : [configuredFileViewerRenderers]),
  archiveRenderer,
  presentationRenderer,
] as ViewerOptions['renderers'];

/** 文件浏览器端只读预览，不依赖外部预览或转换服务。 */
export default function FileViewerPreviewPanel({ file, style }: FileViewerPreviewPanelProps) {
  const { isDark } = useThemeController();
  const options = useMemo<ViewerOptions>(() => ({
    theme: isDark ? 'dark' : 'light',
    locale: 'zh-CN',
    styleIsolation: 'shadow',
    rendererMode: 'replace',
    autoRenderers: false,
    renderers: fileViewerRenderers,
    ui: { density: 'compact' },
    toolbar: {
      position: 'top-center',
      download: false,
      print: true,
      exportHtml: false,
      zoom: true,
      search: true,
      theme: false,
    },
    docx: {
      worker: true,
      visualPagination: true,
    },
    spreadsheet: {
      worker: 'auto',
      textEncoding: 'auto',
      resizableColumns: true,
      resizableRows: true,
    },
    archive: {
      workerUrl: archiveWorkerUrl,
      wasmUrl: archiveWasmUrl,
    },
  }), [isDark]);

  return (
    <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, ...style }}>
      <FileViewer file={file} options={options} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
