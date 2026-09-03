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
  /** 在线升级：仅允许触发一次检查；更新服务器地址固定在打包配置 / 本机运维文件，渲染进程不可改写 */
  updater: {
    check: () => { ipcRenderer.send('updater:check'); },
  },
  isElectron: true,
});
