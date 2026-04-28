const { contextBridge, ipcRenderer } = require('electron');

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
  bvGetTitle: (tabId) => ipcRenderer.invoke('bv:get-title', { tabId }),
  bvGetPageInfo: (tabId) => ipcRenderer.invoke('bv:get-page-info', { tabId }),

  // ========== 缩放 ==========
  bvZoomIn: (tabId) => ipcRenderer.invoke('bv:zoom-in', { tabId }),
  bvZoomOut: (tabId) => ipcRenderer.invoke('bv:zoom-out', { tabId }),
  bvZoomReset: (tabId) => ipcRenderer.invoke('bv:zoom-reset', { tabId }),
  bvGetZoom: (tabId) => ipcRenderer.invoke('bv:get-zoom', { tabId }),

  // ========== 查找 ==========
  bvFindInPage: (tabId, text, forward) => ipcRenderer.invoke('bv:find-in-page', { tabId, text, forward }),
  bvStopFind: (tabId, action) => ipcRenderer.invoke('bv:stop-find', { tabId, action }),

  // ========== DevTools / 打印 / 全屏 ==========
  bvToggleDevtools: (tabId) => ipcRenderer.invoke('bv:toggle-devtools', { tabId }),
  bvPrint: (tabId) => ipcRenderer.invoke('bv:print', { tabId }),
  bvToggleFullscreen: () => ipcRenderer.invoke('bv:toggle-fullscreen'),
  bvCapturePage: (tabId) => ipcRenderer.invoke('bv:capture-page', { tabId }),

  // ========== 下载管理 ==========
  bvGetDownloads: () => ipcRenderer.invoke('bv:get-downloads'),
  bvClearDownloads: () => ipcRenderer.invoke('bv:clear-downloads'),

  // ========== 会话持久化 ==========
  bvSaveSession: (tabs) => ipcRenderer.invoke('bv:save-session', { tabs }),
  bvLoadSession: () => ipcRenderer.invoke('bv:load-session'),

  // ========== 通知 ==========
  bvShowNotification: (title, body) => ipcRenderer.invoke('bv:show-notification', { title, body }),

  // ========== 系统 ==========
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),

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

  // ========== BrowserView 事件 ==========
  onBvTitleUpdated: (cb) => ipcRenderer.on('bv:title-updated', (_, d) => cb(d)),
  onBvFaviconUpdated: (cb) => ipcRenderer.on('bv:favicon-updated', (_, d) => cb(d)),
  onBvLoading: (cb) => ipcRenderer.on('bv:loading', (_, d) => cb(d)),
  onBvNavigated: (cb) => ipcRenderer.on('bv:navigated', (_, d) => cb(d)),
  onBvLoadError: (cb) => ipcRenderer.on('bv:load-error', (_, d) => cb(d)),
  onBvOpenNewTab: (cb) => ipcRenderer.on('bv:open-new-tab', (_, d) => cb(d)),
  onBvCrashed: (cb) => ipcRenderer.on('bv:crashed', (_, d) => cb(d)),
  onBvFullscreen: (cb) => ipcRenderer.on('bv:fullscreen', (_, d) => cb(d)),

  // ========== 下载事件 ==========
  onBvDownloadStarted: (cb) => ipcRenderer.on('bv:download-started', (_, d) => cb(d)),
  onBvDownloadProgress: (cb) => ipcRenderer.on('bv:download-progress', (_, d) => cb(d)),
  onBvDownloadCompleted: (cb) => ipcRenderer.on('bv:download-completed', (_, d) => cb(d)),

  // ========== 通知事件 ==========
  onBvNotification: (cb) => ipcRenderer.on('bv:notification', (_, d) => cb(d)),

  // ========== 菜单事件 ==========
  onMenuNewTab: (cb) => ipcRenderer.on('menu:new-tab', () => cb()),
  onMenuCloseTab: (cb) => ipcRenderer.on('menu:close-tab', () => cb()),
  onMenuReload: (cb) => ipcRenderer.on('menu:reload', () => cb()),
  onMenuForceReload: (cb) => ipcRenderer.on('menu:force-reload', () => cb()),
  onMenuZoomIn: (cb) => ipcRenderer.on('menu:zoom-in', () => cb()),
  onMenuZoomOut: (cb) => ipcRenderer.on('menu:zoom-out', () => cb()),
  onMenuZoomReset: (cb) => ipcRenderer.on('menu:zoom-reset', () => cb()),
  onMenuFind: (cb) => ipcRenderer.on('menu:find', () => cb()),
  onMenuDevtools: (cb) => ipcRenderer.on('menu:devtools', () => cb()),
  onMenuFullscreen: (cb) => ipcRenderer.on('menu:fullscreen', () => cb()),
  onMenuGoBack: (cb) => ipcRenderer.on('menu:go-back', () => cb()),
  onMenuGoForward: (cb) => ipcRenderer.on('menu:go-forward', () => cb()),
  onMenuHistory: (cb) => ipcRenderer.on('menu:history', () => cb()),
  onMenuPrint: (cb) => ipcRenderer.on('menu:print', () => cb()),
  onMenuAbout: (cb) => ipcRenderer.on('menu:about', () => cb()),

  // ========== 通用 ==========
  onNotification: (cb) => ipcRenderer.on('notification', (_, d) => cb(d)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
