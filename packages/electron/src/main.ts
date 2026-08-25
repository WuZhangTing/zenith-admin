import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { initUpdater, resolveWebIndexPath } from './updater';

const isDev = process.env.NODE_ENV === 'development';

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

  // 在浏览器中打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url).catch(console.error);
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
