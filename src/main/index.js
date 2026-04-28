const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
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
const HEADER_HEIGHT = 90; // 标签栏(38) + 导航栏(52)

function getContentBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return { x: 0, y: HEADER_HEIGHT, width: 1200, height: 700 };
  const [w, h] = mainWindow.getContentSize();
  return { x: 0, y: HEADER_HEIGHT, width: w, height: h - HEADER_HEIGHT };
}

// ========== BrowserView 管理 ==========

function createBrowserView(tabId, url, containerId = 'default') {
  if (mainWindow.isDestroyed()) return null;

  const partition = containerId && containerId !== 'default'
    ? `persist:container-${containerId}`
    : 'persist:default';

  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'browser-view-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: session.fromPartition(partition),
      // 允许 web 跳转
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // 设置内容区域
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

  // 监听页面事件，转发给渲染进程
  const wc = view.webContents;

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

  wc.on('did-navigate', (e, url) => {
    sendToRenderer('bv:navigated', { tabId, url, canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward() });
  });

  wc.on('did-navigate-in-page', (e, url) => {
    if (e.isMainFrame) {
      sendToRenderer('bv:navigated', { tabId, url, canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward() });
    }
  });

  wc.on('did-fail-load', (e, errorCode, errorDesc) => {
    if (errorCode !== -3) { // -3 = aborted
      sendToRenderer('bv:load-error', { tabId, errorCode, errorDesc });
    }
  });

  // 新窗口拦截 → 转为新标签
  wc.setWindowOpenHandler(({ url }) => {
    if (url && url !== 'about:blank') {
      sendToRenderer('bv:open-new-tab', { url, containerId });
    }
    return { action: 'deny' };
  });

  // 崩溃恢复
  wc.on('render-process-gone', (e, details) => {
    log.error(`[BrowserView] 崩溃: tabId=${tabId}, reason=${details.reason}`);
    sendToRenderer('bv:crashed', { tabId });
  });

  // 下载拦截
  interceptDownloads(wc.session, partition);

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
  if (mainWindow.isDestroyed()) return;

  // 隐藏当前
  if (activeTabId && browserViews.has(activeTabId)) {
    mainWindow.removeBrowserView(browserViews.get(activeTabId).view);
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
    browserViews.get(activeTabId).view.setBounds(bounds);
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ========== 下载拦截 ==========

const registeredSessions = new Set();

function interceptDownloads(sess, partition) {
  if (registeredSessions.has(partition)) return;
  registeredSessions.add(partition);

  sess.on('will-download', (event, item) => {
    const url = item.getURL();
    const filename = item.getFilename();
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;

    log.info(`[下载拦截] ${filename} ← ${url}`);

    const targetWC = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;

    // 通知渲染进程
    if (targetWC) {
      targetWC.send('bv:download-started', { url, filename, totalBytes: item.getTotalBytes() });
    }

    item.on('updated', () => {
      if (targetWC) {
        targetWC.send('bv:download-progress', {
          filename,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
        });
      }
    });

    item.on('done', (e, state) => {
      if (targetWC) {
        targetWC.send('bv:download-completed', { filename, state });
      }
    });
  });
}

// ========== IPC Handler 注册 ==========

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
  if (entry?.view.webContents.canGoBack()) {
    entry.view.webContents.goBack();
  }
  return true;
});

ipcMain.handle('bv:go-forward', (event, { tabId }) => {
  const entry = browserViews.get(tabId);
  if (entry?.view.webContents.canGoForward()) {
    entry.view.webContents.goForward();
  }
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

  // 窗口大小变化 → 重新定位 BrowserView
  mainWindow.on('resize', () => {
    resizeAllBrowserViews();
  });

  mainWindow.on('closed', () => {
    // 清理所有 BrowserView
    for (const [tabId] of browserViews) {
      destroyBrowserView(tabId);
    }
    mainWindow = null;
  });

  log.info('主窗口已创建 (BrowserView 模式)');
}

app.whenReady().then(() => {
  registerAllHandlers();
  log.info('所有 IPC Handler 已注册');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { createWindow };
