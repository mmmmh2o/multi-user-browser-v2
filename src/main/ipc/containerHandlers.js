const { ipcMain } = require('electron');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

let _store = null;
function getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store({ name: 'containers' });
  }
  return _store;
}

const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#8c8c8c', icon: '🌐' },
];

function registerContainerHandlers() {
  ipcMain.handle('get-containers', async () => {
    try {
      const containers = getStore().get('containers', DEFAULT_CONTAINERS);
      if (!containers.find((c) => c.id === 'default')) {
        containers.unshift(DEFAULT_CONTAINERS[0]);
        getStore().set('containers', containers);
      }
      return containers;
    } catch (error) {
      log.error('获取容器失败:', error);
      return DEFAULT_CONTAINERS;
    }
  });

  ipcMain.handle('save-container', async (event, container) => {
    try {
      const containers = getStore().get('containers', DEFAULT_CONTAINERS);
      const now = Date.now();

      if (container.id) {
        const idx = containers.findIndex((c) => c.id === container.id);
        if (idx !== -1) {
          containers[idx] = { ...containers[idx], ...container, updatedAt: now };
        }
      } else {
        const newContainer = {
          id: uuidv4(),
          name: container.name || '未命名身份',
          color: container.color || '#1677ff',
          icon: container.icon || '🏷️',
          createdAt: now,
        };
        containers.push(newContainer);
        log.info(`新建容器: ${newContainer.name}`);
      }

      getStore().set('containers', containers);
      return container.id
        ? containers.find((c) => c.id === container.id)
        : containers[containers.length - 1];
    } catch (error) {
      log.error('保存容器失败:', error);
      return null;
    }
  });

  ipcMain.handle('delete-container', async (event, containerId) => {
    if (containerId === 'default') return { error: '不能删除默认容器' };
    try {
      let containers = getStore().get('containers', DEFAULT_CONTAINERS);
      containers = containers.filter((c) => c.id !== containerId);
      getStore().set('containers', containers);

      const { session } = require('electron');
      const partition = `persist:container-${containerId}`;
      try { session.fromPartition(partition).clearStorageData(); } catch (e) {}

      log.info(`删除容器: ${containerId}`);
      return containers;
    } catch (error) {
      log.error('删除容器失败:', error);
      return getStore().get('containers', DEFAULT_CONTAINERS);
    }
  });
}

module.exports = { registerContainerHandlers };
