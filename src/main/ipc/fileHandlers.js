const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const log = require('electron-log');
const { pathValidator } = require('../utils/pathValidator');

function registerFileHandlers() {
  ipcMain.handle('get-files', async (event, dirPath) => {
    try {
      const safePath = pathValidator(dirPath);
      const items = await fs.readdir(safePath, { withFileTypes: true });
      const files = await Promise.all(items.map(async (item) => {
        const fullPath = path.join(safePath, item.name);
        try {
          const stat = await fs.stat(fullPath);
          return { name: item.name, path: fullPath, isDirectory: item.isDirectory(), size: stat.size, mtime: stat.mtime };
        } catch { return { name: item.name, path: fullPath, isDirectory: item.isDirectory(), size: 0, mtime: null }; }
      }));
      return files;
    } catch (error) { log.error('获取文件列表失败:', error); return []; }
  });

  ipcMain.handle('create-file', async (event, filePath, content = '') => {
    try { await fs.writeFile(pathValidator(filePath), content); return true; }
    catch (error) { log.error('创建文件失败:', error); return false; }
  });

  ipcMain.handle('create-directory', async (event, dirPath) => {
    try { await fs.ensureDir(pathValidator(dirPath)); return true; }
    catch (error) { log.error('创建目录失败:', error); return false; }
  });

  ipcMain.handle('delete-file', async (event, filePath) => {
    try { await fs.remove(pathValidator(filePath)); return true; }
    catch (error) { log.error('删除文件失败:', error); return false; }
  });

  ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
    try { await fs.rename(pathValidator(oldPath), pathValidator(newPath)); return true; }
    catch (error) { log.error('重命名失败:', error); return false; }
  });

  ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
    try { await fs.copy(pathValidator(sourcePath), pathValidator(destPath)); return true; }
    catch (error) { log.error('复制失败:', error); return false; }
  });

  ipcMain.handle('move-file', async (event, sourcePath, destPath) => {
    try { await fs.move(pathValidator(sourcePath), pathValidator(destPath)); return true; }
    catch (error) { log.error('移动失败:', error); return false; }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try { return await fs.readFile(pathValidator(filePath), 'utf-8'); }
    catch (error) { log.error('读取文件失败:', error); return null; }
  });

  ipcMain.handle('write-file', async (event, filePath, content) => {
    try { await fs.writeFile(pathValidator(filePath), content); return true; }
    catch (error) { log.error('写入文件失败:', error); return false; }
  });
}

module.exports = { registerFileHandlers };
