import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => { ipcRenderer.send('window:minimize'); },
  maximize: () => { ipcRenderer.send('window:maximize'); },
  close: () => { ipcRenderer.send('window:close'); },
  /** 监听最大化状态变化（callback 参数过 contextBridge 是合法的） */
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.removeAllListeners('window:maximized');
    ipcRenderer.on('window:maximized', (_event: Electron.IpcRendererEvent, val: boolean) => callback(val));
  },
  offMaximizeChange: () => {
    ipcRenderer.removeAllListeners('window:maximized');
  },
  /** 在线升级：渲染进程把 API 地址告知主进程（web 包内的 VITE_API_BASE_URL 是权威来源） */
  updater: {
    configure: (cfg: { serverUrl?: string; channel?: string }) => { ipcRenderer.send('updater:configure', cfg); },
    check: () => { ipcRenderer.send('updater:check'); },
  },
  isElectron: true,
});
