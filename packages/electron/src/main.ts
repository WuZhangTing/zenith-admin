import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { initUpdater, resolveWebIndexPath } from './updater';

const isDev = process.env.NODE_ENV === 'development';

const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** 允许交给系统打开的外部地址（与 @zenith/shared/core 的 isSafeExternalUrl 保持一致，主进程不依赖 shared 包） */
function isSafeExternalUrl(value: string): boolean {
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;
  try {
    return SAFE_EXTERNAL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // macOS: 隐藏系统标题栏但保留红绿灯按钮（沉浸感更强）
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    // Windows/Linux: 完全无边框，使用自定义标题栏
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    // 初始不可见，加载完毕后再显示（防止闪烁）
    show: false,
    backgroundColor: '#ffffff',
  });

  // 加载前端
  if (isDev) {
    // 开发模式：连接 Vite dev server
    mainWindow.loadURL('http://localhost:5373').catch(console.error);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：优先加载已应用的 Web 热更资源，否则加载打包内置的前端静态文件
    mainWindow.loadFile(resolveWebIndexPath()).catch(console.error);
  }

  // 加载完毕后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // 在系统浏览器中打开外部链接：只放行 http(s) / mailto，拒绝 file:（UNC 路径会触发 ShellExecute → NTLM 凭据外泄 / 启动可执行文件）等任意协议
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch(console.error);
    else console.warn('[shell] 已拒绝打开非 http(s)/mailto 链接:', url.slice(0, 200));
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC 窗口控制 ──────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── 应用生命周期 ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  initUpdater(() => mainWindow);

  app.on('activate', () => {
    // macOS：点击 Dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 惯例：关闭所有窗口后应用仍留在 Dock
  if (process.platform !== 'darwin') app.quit();
});
