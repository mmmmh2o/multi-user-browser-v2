const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, globalShortcut } = require('electron');
const path = require('path');
const log = require('electron-log');
const { registerAllHandlers } = require('./ipc');

// ========== GPU / 渲染稳定性 ==========
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

// 日志配置
try {
  log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs/main.log');
} catch (e) {}
log.info('应用启动 v2 (BrowserView)');

// ========== 全局状态 ==========
let mainWindow = null;
const browserViews = new Map(); // tabId → { view, containerId, url }
let activeTabId = null;

// ========== UI 布局常量 ==========
const HEADER_HEIGHT = 94; // 标签栏(38) + 导航栏(56)

function getContentBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return { x: 0, y: HEADER_HEIGHT, width: 1200, height: 700 };
  const [w, h] = mainWindow.getContentSize();
  return { x: 0, y: HEADER_HEIGHT, width: w, height: h - HEADER_HEIGHT };
}

// ========== BrowserView 管理 ==========

function createBrowserView(tabId, url, containerId = 'default') {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const partition = containerId && containerId !== 'default'
    ? `persist:container-${containerId}`
    : 'persist:default';

  const sess = session.fromPartition(partition);

  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'browser-view-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: sess,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // 允许 webview 中的弹窗
      javascript: true,
    },
  });

  const bounds = getContentBounds();
  view.setBounds(bounds);
  view.setAutoResize({ width: true, height: true });

  // 加载 URL
  if (url && url !== 'about:blank') {
    view.webContents.loadURL(url).catch((err) => {
      log.error(`[BrowserView] 加载失败: ${url}`, err.message);
    });
  } else {
    view.webContents.loadURL('about:blank');
  }

  const wc = view.webContents;

  // ========== 页面事件转发 ==========

  wc.on('page-title-updated', (e, title) => {
    sendToRenderer('bv:title-updated', { tabId, title });
  });

  wc.on('page-favicon-updated', (e, favicons) => {
    if (favicons?.length > 0) {
      sendToRenderer('bv:favicon-updated', { tabId, favicon: favicons[0] });
    }
  });

  wc.on('did-start-loading', () => {
    sendToRenderer('bv:loading', { tabId, loading: true });
  });

  wc.on('did-stop-loading', () => {
    sendToRenderer('bv:loading', { tabId, loading: false });
  });

  wc.on('did-navigate', (e, navUrl) => {
    sendToRenderer('bv:navigated', {
      tabId, url: navUrl,
      canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
    });
  });

  wc.on('did-navigate-in-page', (e, navUrl) => {
    if (e.isMainFrame) {
      sendToRenderer('bv:navigated', {
        tabId, url: navUrl,
        canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
      });
    }
  });

  wc.on('did-fail-load', (e, errorCode, errorDesc) => {
    if (errorCode !== -3) {
      sendToRenderer('bv:load-error', { tabId, errorCode, errorDesc });
    }
  });

  // ========== 新窗口拦截 → 转为新标签 ==========
  wc.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl && openUrl !== 'about:blank') {
      sendToRenderer('bv:open-new-tab', { url: openUrl, containerId });
    }
    return { action: 'deny' };
  });

  // ========== 崩溃恢复 ==========
  wc.on('render-process-gone', (e, details) => {
    log.error(`[BrowserView] 崩溃: tabId=${tabId}, reason=${details.reason}`);
    sendToRenderer('bv:crashed', { tabId });
  });

  // ========== 下载拦截 ==========
  interceptDownloads(sess, partition);

  // ========== 证书错误处理 ==========
  sess.setCertificateVerifyProc((request, callback) => {
    // 允许所有证书（开发阶段）
    callback(0);
  });

  browserViews.set(tabId, { view, containerId, url });
  log.info(`[BrowserView] 创建: tabId=${tabId}, partition=${partition}`);

  return view;
}

function destroyBrowserView(tabId) {
  const entry = browserViews.get(tabId);
  if (!entry) return;

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeBrowserView(entry.view);
    }
    entry.view.webContents.destroy();
  } catch (e) {
    log.warn(`[BrowserView] 销毁异常: ${tabId}`, e.message);
  }

  browserViews.delete(tabId);
  if (activeTabId === tabId) activeTabId = null;
  log.info(`[BrowserView] 销毁: tabId=${tabId}`);
}

function switchBrowserView(tabId) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // 隐藏当前
  if (activeTabId && browserViews.has(activeTabId)) {
    try { mainWindow.removeBrowserView(browserViews.get(activeTabId).view); } catch (e) {}
  }

  // 显示目标
  const entry = browserViews.get(tabId);
  if (entry) {
    mainWindow.addBrowserView(entry.view);
    entry.view.setBounds(getContentBounds());
    activeTabId = tabId;
    log.info(`[BrowserView] 切换: tabId=${tabId}`);
  }
}

function resizeAllBrowserViews() {
  const bounds = getContentBounds();
  if (activeTabId && browserViews.has(activeTabId)) {
    try { browserViews.get(activeTabId).view.setBounds(bounds); } catch (e) {}
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ========== 下载管理 ==========

const downloads = new Map(); // downloadId → { id, url, filename, totalBytes, receivedBytes, state, startTime, path }
let downloadIdCounter = 0;

function interceptDownloads(sess, partition) {
  const registeredPartitions = new Set();

  if (registeredPartitions.has(partition)) return;
  registeredPartitions.add(partition);

  sess.on('will-download', (event, item) => {
    const url = item.getURL();
    const filename = item.getFilename();
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return;

    const dlId = `dl-${Date.now()}-${++downloadIdCounter}`;
    const downloadInfo = {
      id: dlId,
      url,
      filename,
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'downloading',
      startTime: Date.now(),
      path: item.getSavePath() || '',
    };

    downloads.set(dlId, downloadInfo);
    sendToRenderer('bv:download-started', downloadInfo);
    log.info(`[下载] 开始: ${filename} ← ${url}`);

    item.on('updated', (e, state) => {
      downloadInfo.receivedBytes = item.getReceivedBytes();
      downloadInfo.totalBytes = item.getTotalBytes();
      if (state === 'interrupted') downloadInfo.state = 'paused';
      sendToRenderer('bv:download-progress', {
        id: dlId,
        receivedBytes: downloadInfo.receivedBytes,
        totalBytes: downloadInfo.totalBytes,
        state: downloadInfo.state,
      });
    });

    item.on('done', (e, state) => {
      downloadInfo.state = state === 'completed' ? 'completed' : 'failed';
      downloadInfo.endTime = Date.now();
      sendToRenderer('bv:download-completed', downloadInfo);
      log.info(`[下载] ${filename}: ${state}`);
    });
  });
}

// ========== IPC Handlers ==========

// BrowserView 管理
ipcMain.handle('bv:create', (event, { tabId, url, containerId }) => {
  return !!createBrowserView(tabId, url, containerId);
});

ipcMain.handle('bv:close', (event, { tabId }) => {
  destroyBrowserView(tabId);
  return true;
});

ipcMain.handle('bv:switch', (event, { tabId }) => {
  switchBrowserView(tabId);
  return true;
});

ipcMain.handle('bv:navigate', (event, { tabId, url }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    entry.view.webContents.loadURL(url).catch((err) => {
      log.error(`[BrowserView] 导航失败: ${url}`, err.message);
    });
    entry.url = url;
  }
  return true;
});

ipcMain.handle('bv:go-back', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry?.view.webContents.canGoBack()) entry.view.webContents.goBack();
  return true;
});

ipcMain.handle('bv:go-forward', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry?.view.webContents.canGoForward()) entry.view.webContents.goForward();
  return true;
});

ipcMain.handle('bv:reload', (event, { tabId }) => {
  browserViews.get(tabId)?.view.webContents.reload();
  return true;
});

ipcMain.handle('bv:stop', (event, { tabId }) => {
  browserViews.get(tabId)?.view.webContents.stop();
  return true;
});

ipcMain.handle('bv:get-url', (event, { tabId }) => {
  return browserViews.get(tabId)?.view.webContents.getURL() || '';
});

ipcMain.handle('bv:get-title', (event, { tabId }) => {
  return browserViews.get(tabId)?.view.webContents.getTitle() || '';
});

// 缩放
ipcMain.handle('bv:zoom-in', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    const current = entry.view.webContents.getZoomLevel();
    entry.view.webContents.setZoomLevel(Math.min(current + 0.5, 5));
  }
  return true;
});

ipcMain.handle('bv:zoom-out', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    const current = entry.view.webContents.getZoomLevel();
    entry.view.webContents.setZoomLevel(Math.max(current - 0.5, -5));
  }
  return true;
});

ipcMain.handle('bv:zoom-reset', (event, { tabId }) => {
  browserViews.get(tabId)?.view.webContents.setZoomLevel(0);
  return true;
});

ipcMain.handle('bv:get-zoom', (event, { tabId }) => {
  return browserViews.get(tabId)?.view.webContents.getZoomLevel() || 0;
});

// 查找
ipcMain.handle('bv:find-in-page', (event, { tabId, text, forward }) => {
  const entry = browserViews.get(tabId);
  if (entry && text) {
    entry.view.webContents.findInPage(text, { forward: forward !== false });
  }
  return true;
});

ipcMain.handle('bv:stop-find', (event, { tabId, action }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    entry.view.webContents.stopFindInPage(action || 'clearSelection');
  }
  return true;
});

// DevTools
ipcMain.handle('bv:toggle-devtools', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    if (entry.view.webContents.isDevToolsOpened()) {
      entry.view.webContents.closeDevTools();
    } else {
      entry.view.webContents.openDevTools({ mode: 'detach' });
    }
  }
  return true;
});

// 打印
ipcMain.handle('bv:print', (event, { tabId }) => {
  browserViews.get(tabId)?.view.webContents.print();
  return true;
});

// 全屏
ipcMain.handle('bv:toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
  return true;
});

// 截图
ipcMain.handle('bv:capture-page', async (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry) {
    const image = await entry.view.webContents.capturePage();
    return image.toDataURL();
  }
  return null;
});

// 下载管理
ipcMain.handle('bv:get-downloads', () => {
  return Array.from(downloads.values());
});

ipcMain.handle('bv:clear-downloads', () => {
  downloads.clear();
  return true;
});

// 会话持久化 - 保存标签页
ipcMain.handle('bv:save-session', (event, { tabs }) => {
  try {
    const Store = require('electron-store');
    const store = new Store({ name: 'session' });
    store.set('tabs', tabs);
    store.set('activeTabId', activeTabId);
    log.info('[会话] 已保存');
    return true;
  } catch (e) {
    log.error('[会话] 保存失败:', e);
    return false;
  }
});

ipcMain.handle('bv:load-session', () => {
  try {
    const Store = require('electron-store');
    const store = new Store({ name: 'session' });
    return { tabs: store.get('tabs', []), activeTabId: store.get('activeTabId') };
  } catch (e) {
    return { tabs: [], activeTabId: null };
  }
});

// 通知
ipcMain.handle('bv:show-notification', (event, { title, body }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToRenderer('bv:notification', { title, body, time: Date.now() });
  }
  return true;
});

// 获取页面信息
ipcMain.handle('bv:get-page-info', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (!entry) return null;
  const wc = entry.view.webContents;
  return {
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    isLoading: wc.isLoading(),
    zoomLevel: wc.getZoomLevel(),
  };
});

// ========== 窗口菜单 ==========
function buildAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建标签', accelerator: 'CmdOrCtrl+T', click: () => sendToRenderer('menu:new-tab') },
        { label: '关闭标签', accelerator: 'CmdOrCtrl+W', click: () => sendToRenderer('menu:close-tab') },
        { type: 'separator' },
        { label: '打印', accelerator: 'CmdOrCtrl+P', click: () => sendToRenderer('menu:print') },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => sendToRenderer('menu:reload') },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', click: () => sendToRenderer('menu:force-reload') },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => sendToRenderer('menu:zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => sendToRenderer('menu:zoom-out') },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => sendToRenderer('menu:zoom-reset') },
        { type: 'separator' },
        { label: '查找', accelerator: 'CmdOrCtrl+F', click: () => sendToRenderer('menu:find') },
        { label: '开发者工具', accelerator: 'F12', click: () => sendToRenderer('menu:devtools') },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', click: () => sendToRenderer('menu:fullscreen') },
      ],
    },
    {
      label: '历史',
      submenu: [
        { label: '后退', accelerator: 'Alt+Left', click: () => sendToRenderer('menu:go-back') },
        { label: '前进', accelerator: 'Alt+Right', click: () => sendToRenderer('menu:go-forward') },
        { type: 'separator' },
        { label: '历史记录', accelerator: 'CmdOrCtrl+H', click: () => sendToRenderer('menu:history') },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于', click: () => sendToRenderer('menu:about') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ========== 窗口创建 ==========

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Multi-User Browser v2',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  // 窗口大小变化
  mainWindow.on('resize', () => resizeAllBrowserViews());

  // 全屏变化
  mainWindow.on('enter-full-screen', () => sendToRenderer('bv:fullscreen', { fullscreen: true }));
  mainWindow.on('leave-full-screen', () => sendToRenderer('bv:fullscreen', { fullscreen: false }));

  mainWindow.on('closed', () => {
    for (const [tabId] of browserViews) destroyBrowserView(tabId);
    mainWindow = null;
  });

  // 渲染进程崩溃恢复
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    log.error(`[主窗口] 崩溃: ${details.reason}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
    }, 1000);
  });

  log.info('主窗口已创建 (BrowserView 模式)');
}

app.whenReady().then(() => {
  registerAllHandlers();
  buildAppMenu();
  log.info('所有 IPC Handler 已注册');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  log.info('应用即将退出');
});

module.exports = { createWindow };
