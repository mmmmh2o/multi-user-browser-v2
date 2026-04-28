const { ipcMain } = require('electron');
const log = require('electron-log');

let _store = null;
function getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store({ name: 'scripts' });
  }
  return _store;
}

function registerScriptHandlers() {
  ipcMain.handle('get-scripts', async () => {
    try { return getStore().get('scripts', []); }
    catch (error) { log.error('获取脚本失败:', error); return []; }
  });

  ipcMain.handle('save-script', async (event, script) => {
    try {
      const scripts = getStore().get('scripts', []);
      if (script.id) {
        const idx = scripts.findIndex((s) => s.id === script.id);
        if (idx !== -1) scripts[idx] = { ...scripts[idx], ...script, updatedAt: Date.now() };
      } else {
        scripts.push({ id: Date.now().toString(), ...script, enabled: true, createdAt: Date.now() });
      }
      getStore().set('scripts', scripts);
      return scripts;
    } catch (error) { log.error('保存脚本失败:', error); return null; }
  });

  ipcMain.handle('delete-script', async (event, id) => {
    try {
      let scripts = getStore().get('scripts', []);
      scripts = scripts.filter((s) => s.id !== id);
      getStore().set('scripts', scripts);
      return scripts;
    } catch (error) { log.error('删除脚本失败:', error); return []; }
  });

  ipcMain.handle('get-enabled-scripts', async () => {
    try { return getStore().get('scripts', []).filter((s) => s.enabled); }
    catch (error) { log.error('获取启用脚本失败:', error); return []; }
  });
}

module.exports = { registerScriptHandlers };
