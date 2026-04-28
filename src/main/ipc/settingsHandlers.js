const { ipcMain } = require('electron');
const log = require('electron-log');

let _store = null;
function getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store({ name: 'settings' });
  }
  return _store;
}

const DEFAULT_SETTINGS = {
  homepage: 'about:blank',
  searchEngine: 'google',
  downloadPath: '',
  darkMode: false,
  fontSize: 14,
};

function registerSettingsHandlers() {
  ipcMain.handle('get-settings', async () => {
    try { return { ...DEFAULT_SETTINGS, ...getStore().get('settings', {}) }; }
    catch (error) { log.error('获取设置失败:', error); return DEFAULT_SETTINGS; }
  });

  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      const current = { ...DEFAULT_SETTINGS, ...getStore().get('settings', {}) };
      const merged = { ...current, ...settings };
      getStore().set('settings', merged);
      return merged;
    } catch (error) { log.error('保存设置失败:', error); return null; }
  });

  ipcMain.handle('reset-settings', async () => {
    try { getStore().set('settings', DEFAULT_SETTINGS); return DEFAULT_SETTINGS; }
    catch (error) { log.error('重置设置失败:', error); return null; }
  });
}

module.exports = { registerSettingsHandlers };
