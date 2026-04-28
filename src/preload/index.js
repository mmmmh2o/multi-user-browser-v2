const { contextBridge, ipcRenderer } = require('electron');

/**
 * 渲染进程 Preload - 暴露 electronAPI
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== BrowserView 管理 ==========
  createBrowserView: (tabId, url, containerId) => ipcRenderer.invoke('bv:create', { tabId, url, containerId }),
  closeBrowserView: (tabId) => ipcRenderer.invoke('bv:close', { tabId }),
  switchBrowserView: (tabId) => ipcRenderer.invoke('bv:switch', { tabId }),
  navigateBrowserView: (tabId, url) => ipcRenderer.invoke('bv:navigate', { tabId, url }),
  bvGoBack: (tabId) => ipcRenderer.invoke('bv:go-back', { tabId }),
  bvGoForward: (tabId) => ipcRenderer.invoke('bv:go-forward', { tabId }),
  bvReload: (tabId) => ipcRenderer.invoke('bv:reload', { tabId }),
  bvStop: (tabId) => ipcRenderer.invoke('bv:stop', { tabId }),
  bvGetUrl: (tabId) => ipcRenderer.invoke('bv:get-url', { tabId }),

  // ========== 容器管理 ==========
  getContainers: () => ipcRenderer.invoke('get-containers'),
  saveContainer: (c) => ipcRenderer.invoke('save-container', c),
  deleteContainer: (id) => ipcRenderer.invoke('delete-container', id),

  // ========== 书签 ==========
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  saveBookmark: (b) => ipcRenderer.invoke('save-bookmark', b),
  deleteBookmark: (id) => ipcRenderer.invoke('delete-bookmark', id),

  // ========== 历史 ==========
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (e) => ipcRenderer.invoke('add-history', e),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistory: (id) => ipcRenderer.invoke('delete-history', id),

  // ========== 文件管理 ==========
  getFiles: (dir) => ipcRenderer.invoke('get-files', dir),
  createFile: (p, c) => ipcRenderer.invoke('create-file', p, c),
  createDirectory: (p) => ipcRenderer.invoke('create-directory', p),
  deleteFile: (p) => ipcRenderer.invoke('delete-file', p),
  renameFile: (o, n) => ipcRenderer.invoke('rename-file', o, n),
  copyFile: (s, d) => ipcRenderer.invoke('copy-file', s, d),
  moveFile: (s, d) => ipcRenderer.invoke('move-file', s, d),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, c) => ipcRenderer.invoke('write-file', p, c),

  // ========== 脚本管理 ==========
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  saveScript: (s) => ipcRenderer.invoke('save-script', s),
  deleteScript: (id) => ipcRenderer.invoke('delete-script', id),

  // ========== 设置 ==========
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),

  // ========== 网络代理 ==========
  proxyNetRequest: (opts) => ipcRenderer.invoke('proxy-net-request', opts),

  // ========== BrowserView 事件监听 ==========
  onBvTitleUpdated: (cb) => ipcRenderer.on('bv:title-updated', (_, d) => cb(d)),
  onBvFaviconUpdated: (cb) => ipcRenderer.on('bv:favicon-updated', (_, d) => cb(d)),
  onBvLoading: (cb) => ipcRenderer.on('bv:loading', (_, d) => cb(d)),
  onBvNavigated: (cb) => ipcRenderer.on('bv:navigated', (_, d) => cb(d)),
  onBvLoadError: (cb) => ipcRenderer.on('bv:load-error', (_, d) => cb(d)),
  onBvOpenNewTab: (cb) => ipcRenderer.on('bv:open-new-tab', (_, d) => cb(d)),
  onBvCrashed: (cb) => ipcRenderer.on('bv:crashed', (_, d) => cb(d)),

  // ========== 通用事件 ==========
  onNotification: (cb) => ipcRenderer.on('notification', (_, d) => cb(d)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
