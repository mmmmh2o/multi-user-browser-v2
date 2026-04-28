const { ipcMain } = require('electron');
const log = require('electron-log');

let _store = null;
function getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store({ name: 'bookmarks' });
  }
  return _store;
}

function registerBookmarkHandlers() {
  ipcMain.handle('get-bookmarks', async () => {
    try { return getStore().get('bookmarks', []); }
    catch (error) { log.error('获取书签失败:', error); return []; }
  });

  ipcMain.handle('save-bookmark', async (event, bookmark) => {
    try {
      const bookmarks = getStore().get('bookmarks', []);
      const newBookmark = { id: Date.now().toString(), ...bookmark, createdAt: Date.now() };
      bookmarks.unshift(newBookmark);
      getStore().set('bookmarks', bookmarks);
      return newBookmark;
    } catch (error) { log.error('保存书签失败:', error); return null; }
  });

  ipcMain.handle('delete-bookmark', async (event, id) => {
    try {
      let bookmarks = getStore().get('bookmarks', []);
      bookmarks = bookmarks.filter((b) => b.id !== id);
      getStore().set('bookmarks', bookmarks);
      return bookmarks;
    } catch (error) { log.error('删除书签失败:', error); return []; }
  });
}

module.exports = { registerBookmarkHandlers };
