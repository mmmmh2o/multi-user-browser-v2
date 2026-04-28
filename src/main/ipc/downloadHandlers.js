const { ipcMain, app } = require('electron');
const log = require('electron-log');

function registerDownloadHandlers() {
  ipcMain.handle('get-home-dir', async () => {
    try { return app.getPath('home'); }
    catch { return '/'; }
  });
}

module.exports = { registerDownloadHandlers };
