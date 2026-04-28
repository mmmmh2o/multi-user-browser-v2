const log = require('electron-log');

const handlers = [
  { name: 'container', fn: () => require('./containerHandlers').registerContainerHandlers() },
  { name: 'file', fn: () => require('./fileHandlers').registerFileHandlers() },
  { name: 'download', fn: () => require('./downloadHandlers').registerDownloadHandlers() },
  { name: 'bookmark', fn: () => require('./bookmarkHandlers').registerBookmarkHandlers() },
  { name: 'history', fn: () => require('./historyHandlers').registerHistoryHandlers() },
  { name: 'script', fn: () => require('./scriptHandlers').registerScriptHandlers() },
  { name: 'settings', fn: () => require('./settingsHandlers').registerSettingsHandlers() },
  { name: 'net', fn: () => require('./netHandlers').registerNetHandlers() },
];

function registerAllHandlers() {
  let successCount = 0;
  let failCount = 0;

  for (const { name, fn } of handlers) {
    try {
      fn();
      successCount++;
    } catch (error) {
      failCount++;
      log.error(`[IPC] ${name} handlers 注册失败:`, error);
    }
  }

  log.info(`[IPC] 注册完成: ${successCount} 成功, ${failCount} 失败`);
}

module.exports = { registerAllHandlers };
