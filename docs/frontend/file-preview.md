# 文件预览组件

`FilePreviewModal` 是全站统一的文件预览弹窗，支持图片、PDF、OFD、音频、视频、Excel/CSV 表格、Word 文档、PowerPoint 演示文稿、压缩包、邮件、XMind 脑图、draw.io / Excalidraw / Mermaid / PlantUML 图形、Markdown、纯文本、JSON、SVG 和代码文件。调用方只需传入文件元数据，无需自行判断格式或引入额外组件。

托管文件列表页推荐使用更高一层的组合：`useFilePreview` hook（`@/hooks/useFilePreview`）+ `FilePreviewLayer`（`@/components/FilePreviewLayer`），它在 `FilePreviewModal` 之上补齐了图片图集预览、不可预览文件新窗口打开与鉴权下载，见下文[使用示例](#使用示例)。

**文件位置**：`packages/web/src/components/FilePreviewModal/`

---

## 支持的文件格式

| 格式 | MIME 类型 | 渲染方式 |
| --- | --- | --- |
| 普通图片 | `image/*`（除 `image/svg+xml`） | 回退给调用方的 Semi Design `ImagePreview` |
| HEIC / HEIF / TIFF | `image/heic` / `image/heif` / `image/tiff` | 由 `image-decode` 转码为 PNG 后，同样走 Semi `ImagePreview` 图集 |
| PDF | `application/pdf` | `@embedpdf/react-pdf-viewer`（`PDFPreviewPanel`） |
| OFD | `.ofd` / `application/ofd` / `application/vnd.ofd` | File Viewer OFD renderer（`FileViewerPreviewPanel`，懒加载） |
| 音频 | `audio/*` | Semi Design `AudioPlayer`（页面底部播放条） |
| 视频 | `video/*` | Semi Design `VideoPlayer` |
| 表格 | `.xls/.xlsx/.xlt/.xltx/.xlsm/.xlsb/.xltm/.csv/.tsv/.ods/.fods/.numbers` 对应 MIME | File Viewer Spreadsheet renderer（`FileViewerPreviewPanel`，懒加载） |
| 文本文档 | `.doc/.docx/.docm/.dot/.dotx/.dotm/.odt/.rtf` 对应 MIME | File Viewer Word renderer（`FileViewerPreviewPanel`，懒加载） |
| 演示文稿 | `.ppt/.pptx/.pptm/.potx/.potm/.ppsx/.ppsm/.odp` 对应 MIME | File Viewer Presentation/OpenDocument renderer（`FileViewerPreviewPanel`，懒加载） |
| 邮件 | `.eml/.msg/.mbox` 对应 MIME | File Viewer Email renderer（`FileViewerPreviewPanel`，懒加载） |
| XMind 脑图 | `.xmind` / `application/vnd.xmind.workbook` | File Viewer Mind Map renderer（`FileViewerPreviewPanel`，懒加载） |
| 图形 | `.drawio/.dio` / `.excalidraw` / `.mermaid/.mmd` / `.plantuml/.puml` 对应 MIME | File Viewer Drawing renderer（`FileViewerPreviewPanel`，懒加载） |
| Markdown | `text/markdown` / `text/x-markdown` | `react-markdown` 渲染（`MarkdownPreviewPanel`，懒加载） |
| 纯文本 | `text/plain` | Monaco Editor 只读展示（`MonacoPreviewPanel`，懒加载） |
| JSON | `application/json` / `text/json` | Semi Design `JsonViewer` 只读展示（`JsonPreviewPanel`，懒加载） |
| SVG | `image/svg+xml` | 鉴权下载 Blob 后创建 Object URL，用 `<img>` 居中展示 |
| 代码/配置 | JavaScript、TypeScript、Python、CSS、HTML、XML、YAML、Shell、SQL 等 MIME 类型 | Monaco Editor 语法高亮只读展示（`MonacoPreviewPanel`，懒加载） |
| 压缩包 | Archive renderer 支持的 ZIP、7z、RAR、TAR、GZIP、ISO、JAR、APK、CBZ/CBR 等 MIME | File Viewer Archive renderer（`FileViewerPreviewPanel`，懒加载） |

> **普通图片**不在 `FilePreviewModal` 内部渲染。遇到非 SVG 的 `image/*` 时组件会立即调用 `onClose` 并回退，由调用方自行打开 `ImagePreview`。
>
> **HEIC / HEIF / TIFF** 浏览器无法原生解码，直接渲染会得到裂图。这三类在**创建 Object URL 之前**由 `@/utils/image-decode` 转成 PNG，因此仍然走 `ImagePreview` 图集，与普通图片享有完全相同的交互（左右切换、渐进加载、缩放）。**图片只有一套预览机制**，不为个别格式引入第二套弹窗，详见[图片解码层](#图片解码层-heic-heif-tiff)。
>
> **Office 文件**已开放当前三个 File Viewer renderer 的全部真实扩展名：Word/OpenDocument 文本为 `.doc/.docx/.docm/.dot/.dotx/.dotm/.odt/.rtf`，Spreadsheet 为 `.xls/.xlsx/.xlt/.xltx/.xlsm/.xlsb/.xltm/.csv/.tsv/.ods/.fods/.numbers`，Presentation/OpenDocument 演示为 `.ppt/.pptx/.pptm/.potx/.potm/.ppsx/.ppsm/.odp`。全部在浏览器本地解析，不调用外部预览或文档转换服务。
>
> **旧版 `.ppt`** 使用 File Viewer 独立的二进制 PPT 引擎，公开版运行时会显示水印；移除水印需要取得该引擎的商业授权。`.pptx` 不受此项限制。
>
> **OFD 文件**使用纯前端 `ofd.js` 解析，支持电子签章外观预览，但不执行国密验签；不调用外部预览或转换服务。
>
> **Markdown** 支持 `text/markdown`（`.md`）和 `text/x-markdown`（`.markdown`）两种 MIME 类型。
>
> **压缩包**已开放 File Viewer Archive renderer 的全部 30 个真实扩展名：`.zip/.zipx/.7z/.rar/.tar/.gz/.gzip/.tgz/.bz2/.bzip2/.tbz/.tbz2/.xz/.txz/.lzma/.zst/.tzst/.cab/.ar/.cpio/.iso/.xar/.lha/.lzh/.jar/.war/.ear/.apk/.cbz/.cbr`。使用本地 Worker + WASM 解析，不调用外部服务。
>
> **邮件、XMind 与图形文件**均在浏览器本地解析。邮件 HTML 在无权限 sandbox iframe 中展示；Mermaid 使用 strict 安全级别生成并清理 SVG；draw.io 使用内置离线 SVG 渲染；Excalidraw 使用 `roughjs` 生成只读 SVG；PlantUML 默认离线展示源码；不配置外部预览、CDN 或图表服务。

---

## Props

| Prop | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fileUrl` | `string` | ✅ | 文件访问 URL，通常为 `/api/files/{id}/content` |
| `fileName` | `string` | 否 | 文件名，显示在标题栏；默认 `'文件'` |
| `mimeType` | `string \| null` | 否 | MIME 类型，决定走哪个渲染分支；缺失或为通用二进制类型时按 `fileName` 扩展名回退 |
| `visible` | `boolean` | ✅ | 控制弹窗显示/隐藏 |
| `onClose` | `() => void` | ✅ | 关闭回调 |
| `onFallback` | `(url, name, mime) => void` | 否 | 遇到不支持格式时触发；不传则静默关闭 |
| `style` | `CSSProperties` | 否 | 预留样式参数 |

---

## 使用示例

### 托管文件列表：useFilePreview + FilePreviewLayer（推荐）

文件管理、存储浏览这类展示 `ManagedFile` 列表的页面，直接使用组合方案——图片走图集预览（点击图优先加载、其余后台渐进加载），可预览的非图片打开 `FilePreviewModal`，其他类型拉取 Blob 后新窗口打开；`handleDownload` 提供鉴权下载：

```tsx
import { useFilePreview } from '@/hooks/useFilePreview';
import { FilePreviewLayer } from '@/components/FilePreviewLayer';

const preview = useFilePreview(() => data?.list ?? []); // 返回当前列表，构建图集用

// 表格操作列
<Button onClick={() => void preview.handlePreview(record)}>预览</Button>
<Button onClick={() => void preview.handleDownload(record)}>下载</Button>

// 页面尾部渲染弹层
<FilePreviewLayer preview={preview} />
```

### 直接使用 FilePreviewModal

```tsx
import FilePreviewModal from '@/components/FilePreviewModal';

const [preview, setPreview] = useState<{
  url: string;
  name: string;
  mimeType: string;
} | null>(null);

// 触发预览
const handlePreview = (file: ManagedFile) => {
  setPreview({
    url: file.url,
    name: file.originalName,
    mimeType: file.mimeType ?? 'application/octet-stream',
  });
};

// 渲染
<FilePreviewModal
  fileUrl={preview?.url ?? ''}
  fileName={preview?.name}
  mimeType={preview?.mimeType}
  visible={!!preview}
  onClose={() => setPreview(null)}
/>
```

### 使用 `canPreviewFile` 控制按钮状态

```tsx
import { canPreviewFile } from '@/utils/file-utils';

// 在表格操作列中：
const isPreviewable = canPreviewFile(record.mimeType, record.originalName);

<Button
  theme="borderless"
  size="small"
  disabled={!isPreviewable}
  onClick={() => handlePreview(record)}
>
  预览
</Button>
```

`canPreviewFile` 覆盖全部可预览格式（image / audio / video / PDF / OFD / Office / OpenDocument / email / XMind / drawing / markdown / text / json / svg / code / archive），调用方无需手动枚举 MIME 类型。

---

## 各格式实现细节

::: tip 文件内容如何获取与呈现
所有格式统一通过 `fetchManagedFileBlob(fileUrl)` 获取 Blob：能从 URL 解析出托管文件 ID 时，先调用 access-url 接口换取直链（public/presigned 模式直连对象存储，卸载服务器代理流量），换链失败或非托管文件 URL 时降级为携带认证头的代理读取（`fetchProtectedFile`）。

预览数据的加载由弹窗内部的 TanStack Query 管理（`staleTime: 0`、`gcTime: 0`，文件内容不进缓存），加载失败 Toast 提示并关闭弹窗。弹窗标题统一为「文件类型彩色图标（vscode-icons）+ 文件名省略展示」；表格 / 文档 / 文本类弹窗右上角支持全屏切换。
:::

### PDF

下载 Blob 后以 `File` 对象喂给 `PDFPreviewPanel`（基于 `@embedpdf/react-pdf-viewer`，懒加载）。支持页面缩放、适合页宽/页高等模式；弹窗使用面板自带的标题栏与工具条（不套 `AppModal`），宽度 `min(1100px, 92vw)`，高度 88vh。

#### 本地化加载（去 CDN）

`@embedpdf` 默认会在运行时从外部 CDN 拉取若干资源。为保证**内网/国内网络（jsDelivr、Google Fonts 不可达）**下也能正常预览，`PDFPreviewPanel`通过 `PDFViewer` 的 `config` 将其全部本地化或关闭：

| 默认 CDN 资源 | 默认来源 | 处理方式 |
| --- | --- | --- |
| `pdfium.wasm`（PDF 渲染引擎） | jsDelivr | **本地 npm 引入**，见下方说明 |
| `default-stamps`（印章 `manifest.json` + `stamps.pdf`） | jsDelivr | `stamp: { manifests: [] }` 禁用（只读预览不使用印章/批注） |
| UI 字体 `Open Sans` | Google Fonts | `fonts: { ui: null }`，回退系统字体栈（拉丁字体，中文 UI 无影响） |
| 签名手写体字体 | Google Fonts | `fonts: { signature: null }`（`signature` 分类已禁用） |

**wasm 本地引入的关键点**：

```ts
// 经 npm 安装的 @embedpdf/pdfium 直接引入 wasm，Vite 在 dev/生产均处理为本地资源
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

// ⚠️ 必须转为带 origin 的绝对 URL：
// Vite 的 ?url 在 dev 返回根相对路径（/@fs/...），而 EmbedPDF 在一个 blob: URL 的
// Web Worker 内 fetch 该地址，blob: 基址无法解析根相对/相对路径，会抛 "Failed to
// parse URL" 导致引擎卡在"文件加载中..."。
const pdfiumWasmAbsUrl = new URL(pdfiumWasmUrl, globalThis.location.origin).href;

<PDFViewer config={{ wasmUrl: pdfiumWasmAbsUrl, /* ... */ }} />
```

> 因为 web 源码直接 `import` 了 `@embedpdf/pdfium`，需在 `packages/web/package.json` 中将其声明为**显式依赖**（而非仅依赖 `react-pdf-viewer` 的传递依赖），避免依赖树变化时解析失败。
>
> 生产构建后 wasm 会作为本地资源产出到 `dist/assets/pdfium-*.wasm`（约 4.6MB）。打包产物里仍可搜到 `cdn.jsdelivr` 字符串，那是库源码内的**默认常量**，运行时已被 `config` 覆盖，不会真正请求。

**尚未本地化**：当 PDF 含**未内嵌字体**（部分 CJK 文档）时，`@embedpdf` 仍会按需从 jsDelivr 拉取 `fontFallback` 字形字体。如需彻底零 CDN，需引入约 10MB 的 `@embedpdf/fonts-*` 包并配置 `fontFallback`。

### 音频 / 视频

同样下载 Blob 后创建 `Object URL`，关闭时主动调用 `URL.revokeObjectURL` 释放内存。

- **音频**：不占用弹窗——通过 Portal 固定在页面底部以播放条形式呈现（Semi `AudioPlayer` 自动播放，右侧带关闭按钮），浏览列表时可继续播放
- **视频**：`AppModal` 内使用 Semi `VideoPlayer` 播放，宽度 `min(960px, 92vw)`

### Markdown（.md）

下载 Blob 并读取为 UTF-8 字符串后，**懒加载** `MarkdownPreviewPanel`，使用 `react-markdown` 渲染为 React 组件树。**无 `dangerouslySetInnerHTML`，无 XSS 风险，无需后端改动**。

`MarkdownPreviewPanel`插件配置：

```text
remarkPlugins: [remarkGfm]   // GFM：表格、任务列表、删除线、自动链接
rehypePlugins: [rehypeHighlight]  // 代码块语法高亮（highlight.js）
```

**支持**：标题、列表、任务列表、表格、代码块语法高亮、划线引用、分割线、图片、加粗、斜体、删除线、行内代码

**限制**：

- 不启用 `rehype-raw`，Markdown 中的 HTML 按文本处理
- 尾注需额外启用 `remark-footnotes` 插件（未预装）
- 弹窗宽度 `min(900px, 92vw)`，高度 `90vh`，内容带最大宽 860px 居中

**依赖**（`packages/web`）：

```text
react-markdown
remark-gfm
rehype-highlight
highlight.js（rehype-highlight 的 peerDep）
```

### 纯文本 / 代码

纯文本（`text/plain`）和常见代码/配置 MIME 类型下载 Blob 并读取为 UTF-8 字符串后，**懒加载** `MonacoPreviewPanel` 只读展示。组件会根据文件扩展名自动选择语言（如 `ts/tsx/js/jsx/json/html/css/md/py/go/rs/java/sh/yml/xml/sql` 等），支持语法高亮、折叠、行号和自动换行。弹窗宽度 `min(1100px, 92vw)`，高度 90vh。

`FilePreviewModal` 会将 MIME 为 `video/mp2t` 但文件名以 `.ts` / `.tsx` 结尾的文件按代码文件处理，避免 TypeScript 文件被误判为视频。

### JSON

JSON 文件（`application/json` / `text/json`）下载并读取文本后，**懒加载** `JsonPreviewPanel`，使用 Semi Design `JsonViewer` 只读展示，支持折叠/展开和语法高亮。JSON 解析失败时降级为等宽原始文本。弹窗宽度 `min(900px, 92vw)`，高度 88vh。

### SVG

SVG 文件（`image/svg+xml`）下载 Blob 后创建 Object URL，在 `AppModal` 内使用 `<img>` 居中展示（宽度 `min(900px, 92vw)`，高度 80vh）。关闭预览时会主动释放 Object URL。

### 图片解码层（HEIC / HEIF / TIFF）

`packages/web/src/utils/image-decode.ts`

Chrome / Edge / Firefox 都无法原生解码 HEIC/HEIF（iPhone 默认相机格式）与 TIFF（扫描件、传真件），
把它们直接交给 `<img>` 只会得到裂图。本层在 **`URL.createObjectURL` 之前**把这类 Blob 转成 PNG：

| 格式 | 解码器 | 说明 |
| --- | --- | --- |
| `.heic` / `.heif` | `heic2any` | 内部使用 Web Worker，不阻塞主线程 |
| `.tiff` / `.tif` | `utif2` + canvas | `decode` → `decodeImage` → `toRGBA8` → `putImageData` → `toBlob('image/png')` |

两个解码器都拆成独立异步 chunk，只有真正遇到对应格式时才下载，不进入首屏（`dist/index.html` 无相关 modulepreload）：
`vendor-heic2any` 约 1.35MB（gzip 345KB）、`vendor-utif2` 约 61KB、`vendor-pako`（utif2 的解压依赖）约 45KB。

```ts
import { createDisplayableImageUrl } from '@/utils/image-decode';

const blob = await fetchManagedFileBlob(file.url);
const url = await createDisplayableImageUrl(blob, file.mimeType, file.originalName);
```

**为什么不用 `@file-viewer/renderer-image`**：该 renderer 只对 HEIC/HEIF 真正调用 `heic2any` 解码，
TIFF/JXL 仍然原样丢给 `<img>`（解不出就报 `The browser could not decode this image format.`），
并不能解决 TIFF；而且它渲染在自己的弹窗里，会让图片分裂成「图集」和「单文件弹窗」两套交互。
本层只做格式转换、不接管展示，因此 HEIC/TIFF 能直接进入既有图集。

**约定与边界**：

- **所有图集加载点统一调用 `createDisplayableImageUrl`**，新增图片预览入口时不要直接 `URL.createObjectURL(blob)`，
  否则该入口的 HEIC/TIFF 会退回裂图。当前接入点：
  `hooks/useFilePreview.ts`（托管文件）、`pages/system/file-manager/hooks/useFsPreview.ts`（服务器文件）、
  `pages/chat/hooks/useImagePreview.ts`（消息图片）
- 返回的 Object URL 生命周期仍由调用方管理（`revokeObjectURL`）；转码是 `await`，
  调用方在 `await` 之后要重新校验会话令牌，避免过期加载写入并泄漏 URL
- **解码失败不抛出**，回退原始 Blob——表现退化为「该图裂图」，不会让整个图集中断
- **多页 TIFF 只展示第一页**：图集按「一个文件一张图」组织，展开多页会打乱索引对齐
- 两个解码器都是 `import()` 懒加载，未遇到对应格式时不进入首屏包
- `heic2any` 与 `utif2` 均为 CJS/UMD 包，统一经 `interopDefault`（`mod.default ?? mod`）取模块对象。
  `utif2` 的导出在 IIFE 内动态挂载，打包器的命名导出静态分析对它不可靠，
  而包内自带的 `UTIF.d.ts` 会让 TypeScript 通过检查——这条契约由 `image-decode.interop.test.ts` 用真实
  TIFF 文件守住

---

### Office / OFD / 压缩包 / 邮件 / XMind / 图形

下载 Blob 后包装为保留原始文件名和 MIME 类型的 `File`，再**懒加载** `FileViewerPreviewPanel`。面板使用 File Viewer 的模块化 React 组件，按需注册 Spreadsheet、Word、Presentation、OFD、Archive、Email、Mind Map 与 Drawing renderer；PDF、Markdown 等格式仍沿用各自的现有实现。

```text
@file-viewer/react
@file-viewer/renderer-archive
@file-viewer/renderer-drawing
@file-viewer/renderer-email
@file-viewer/renderer-mindmap
@file-viewer/renderer-ofd
@file-viewer/renderer-spreadsheet
@file-viewer/renderer-word
@file-viewer/renderer-presentation
```

关键配置：

- `rendererMode: 'replace'` + `autoRenderers: false`：能力范围只包含显式装配的 renderer
- `styleIsolation: 'shadow'`：隔离渲染器样式与后台全局样式
- `spreadsheet.worker: 'auto'`：大文件自动使用本地 Worker；CSV 编码自动识别 UTF-8、GBK 与 GB18030
- `spreadsheet.resizableColumns/resizableRows: true`：预览时允许拖拽调整列宽和行高
- `docx.worker: true` + `visualPagination: true`：Word 使用本地 Worker 并保留分页阅读
- Archive 使用本地 `libarchive.js` Worker + WASM，支持目录搜索、加密包密码输入、内部文件按需解压与嵌套预览
- OFD 使用纯前端 `ofd.js`、本地 XML 与 ZIP 解析链路，支持页面缩放、打印和电子签章外观预览
- Email 使用 `postal-mime` / `msgreader` 本地解析 EML、MSG、MBOX，HTML 正文使用无权限 sandbox iframe，只读展示正文、头信息与附件
- XMind 使用本地 parser 解析 2020+ `content.json` 与 XMind 8 `content.xml`，支持多 sheet、节点层级和 Panzoom 画布
- Mermaid 使用本地 `mermaid` 且固定 strict 安全级别，生成并清理 SVG 后提供平移、缩放与打印
- `drawing.preferOfficial: false`：draw.io 直接使用 renderer 内置的离线 SVG 渲染（解析 `mxGraphModel` 输出节点、连线与箭头），不加载官方 diagrams.net `viewer-static.min.js`——`@file-viewer/vite-plugin` 的 `copyAssets` 不分发该 vendor 脚本（仅 `*-full` 包自带），保留默认值只会先 404、再等超时才回退
- Excalidraw 使用 renderer 自带的 `roughjs` 生成只读 SVG；未安装官方 `@excalidraw/excalidraw` 时不会尝试联网加载
- PlantUML 默认完全离线，展示 SVG 源码预览；需要成图时可给 `drawing.plantumlServerUrl` 指向**内网自托管**的 PlantUML SVG 服务
- 工具栏保留缩放、搜索、打印，关闭重复的下载和主题切换入口
- Word/OFD 弹窗宽度 `min(960px, 92vw)`，Excel/CSV/PowerPoint/Archive/Email/XMind/图形 为 `min(1200px, 94vw)`，高度均为 `90vh`

**离线资源**：`@file-viewer/vite-plugin` 按 `word/spreadsheet/ofd/email/xmind/mermaid/drawio/dio/excalidraw/plantuml/puml` 格式装配 Word、Spreadsheet、OFD、Email、Mind Map 与 Drawing；
Drawing 的四类格式（Mermaid / draw.io / Excalidraw / PlantUML）共用同一个 renderer，追加扩展名不会引入新的 renderer 包或额外资源。
Word、Spreadsheet 所需 Worker 复制到 `file-viewer/`，OFD 的纯 JS vendor 由 Vite 按需打包。Presentation 与 Archive renderer 在 `FileViewerPreviewPanel` 中显式注册，
其 Worker/WASM/字体由 Vite 输出到 `assets/`；不要同时把 Presentation 或 Archive 扩展名加回插件的
`formats`，否则同一资源会再复制到 `file-viewer/`。开发时插件资源生成到
`packages/web/public/file-viewer/`（已忽略版本控制），生产构建生成到 `dist/file-viewer/`；
运行时不访问外部 CDN 或预览服务。

**限制**：

- Excel 公式使用文件内缓存值，宏、外部数据连接和交互式图表不会执行
- Office 复杂排版、SmartArt、动画、嵌入对象、宏等与 Microsoft Office 原生渲染可能存在差异
- 文档引用的本机字体不存在时会降级到可用字体
- 旧版 `.ppt` 公开运行时带水印，去水印需要该引擎商业授权；`.pptx` 无此限制
- OFD 电子签章仅渲染外观，不提供签名有效性或国密算法验签结论
- 压缩包内部文件只有在对应 renderer 已装配时才能嵌套预览；其他条目仍可查看目录或下载
- MBOX 当前展示解析出的第一封邮件，并提示识别到的邮件总数
- draw.io 走内置离线渲染，复杂样式、自定义图形库（stencils）与容器嵌套的还原度低于官方 viewer；需要高保真时自行托管 `viewer-static.min.js` 并配置 `drawing.viewerScriptUrl` + `preferOfficial: true`
- PlantUML 未配置 `plantumlServerUrl` 时只展示源码，不出图

> `@univerjs/presets`、`@univerjs/preset-sheets-core`、`jszip` 与服务端 `exceljs` 未随预览链路删除：前两个仍服务于打印报表设计器和数据库 Excel 粘贴导入，`jszip` 仍由 `data-grid/xlsx-write.ts` 生成 XLSX，`exceljs` 仍服务于用户导入导出、导出中心和报表文件处理。

---

## 工具函数

`packages/web/src/utils/file-utils.tsx` 提供以下辅助函数，`FilePreviewModal` / `useFilePreview` 内部也复用同一套判断：

```ts
/** 判断是否支持预览；MIME 缺失/通用时可按文件名扩展回退 */
canPreviewFile(mimeType: string | null | undefined, fileName?: string | null): boolean

/** 细分格式判断 */
isSpreadsheetFile / isWordFile / isPresentationFile / isOfdFile / isEmailFile / isMindMapFile / isDrawingFile / isMarkdownFile / isPlainTextFile /
isJsonFile / isSvgFile / isCodeFile / isArchiveFile / isZipFile(mimeType?: string | null): boolean

/** 按文件名扩展（优先）与 MIME 类型返回 vscode-icons 彩色图标节点，用于列表与预览标题 */
getFileTypeIcon(fileName?: string | null, mimeType?: string | null, size?: number): ReactNode

/** 按扩展名猜测 MIME 类型（上传/终端文件等缺 MIME 的场景） */
guessMimeTypeFromName(name: string): string | null

/** 优先明确 MIME，缺失或通用二进制 MIME 时按文件名回退 */
resolveFileMimeType(mimeType: string | null | undefined, fileName?: string | null): string | null

/** 文件大小人性化格式化 */
formatFileSize(bytes: number): string

/** 获取托管文件 Blob：直链优先，失败降级代理读取（预览/下载统一入口） */
fetchManagedFileBlob(url: string): Promise<Blob>

/** 从 /api/files/{id}/content 形态的 URL 解析托管文件 ID */
extractManagedFileId(url: string): string | null

/** 携带认证头读取受保护文件（绝对 URL 直链则裸 fetch） */
fetchProtectedFile(url: string): Promise<Blob>
```

`packages/web/src/utils/image-decode.ts` 提供图片展示前的规范化解码：

```ts
/** 是否为浏览器无法原生解码、需要前端转码的图片格式（HEIC / HEIF / TIFF） */
needsImageTranscode(mimeType?: string | null, fileName?: string | null): boolean

/** 转成浏览器可直接渲染的 Blob；无需转码或解码失败时返回原 Blob */
toDisplayableImageBlob(blob: Blob, mimeType?: string | null, fileName?: string | null): Promise<Blob>

/** 转码后创建 Object URL —— 所有图集加载点的统一入口 */
createDisplayableImageUrl(blob: Blob, mimeType?: string | null, fileName?: string | null): Promise<string>
```

---

## 已接入的页面

| 页面 | 接入方式 | 文件来源 |
| --- | --- | --- |
| 文件管理 | `FilesPage`：`useFilePreview` + `FilePreviewLayer` | 托管文件代理 URL |
| 存储浏览 | `StorageFileBrowser`：`useFilePreview` + `FilePreviewLayer` | 托管文件代理 URL |
| 文件附件 | `FileAttachment`：直接渲染 `FilePreviewModal` | 附件文件 URL |
| 消息中心 | `ChatPage`：直接渲染 `FilePreviewModal` | 消息附件 URL |
| 服务器文件管理器 | `FileManagerPage`：直接渲染 `FilePreviewModal` | 宿主机文件下载 URL |

---

## 新页面接入

**托管文件列表页**（推荐）：使用 `useFilePreview(getImageFiles)` + `<FilePreviewLayer preview={...} />`，图集预览、格式分发、新窗口回退、鉴权下载一步到位（见上文使用示例）。

**其他简单场景**只需三步：

1. 将文件数据存入状态，包含 `url / name / mimeType`
2. 在触发预览前用 `canPreviewFile(mimeType, fileName)` 判断是否显示预览入口
3. 渲染 `<FilePreviewModal fileUrl={url} fileName={name} mimeType={mime} visible={visible} onClose={onClose} />`

其余逻辑（格式分发、懒加载、直链换取与认证、资源回收）均由组件内部处理。普通图片需自行处理 `onFallback` / 图集展示，或直接采用上面的组合方案。
