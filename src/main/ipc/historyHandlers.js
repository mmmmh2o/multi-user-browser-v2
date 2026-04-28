const { ipcMain } = require('electron');
const log = require('electron-log');
const { MAX_HISTORY } = require('../../shared/constants');

let _store = null;
function getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store({ name: 'history' });
  }
  return _store;
}

function registerHistoryHandlers() {
  ipcMain.handle('get-history', async () => {
    try { return getStore().get('history', []); }
    catch (error) { log.error('获取历史失败:', error); return []; }
  });

  ipcMain.handle('add-history', async (event, entry) => {
    try {
      const history = getStore().get('history', []);
      const newEntry = { id: Date.now().toString(), ...entry, timestamp: Date.now() };
      history.unshift(newEntry);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      getStore().set('history', history);
      return newEntry;
    } catch (error) { log.error('添加历史失败:', error); return null; }
  });

  ipcMain.handle('clear-history', async () => {
    try { getStore().set('history', []); return true; }
    catch (error) { log.error('清空历史失败:', error); return false; }
  });

  ipcMain.handle('delete-history', async (event, id) => {
    try {
      let history = getStore().get('history', []);
      history = history.filter((h) => h.id !== id);
      getStore().set('history', history);
      return history;
    } catch (error) { log.error('删除历史失败:', error); return []; }
  });
}

module.exports = { registerHistoryHandlers };
