const { ipcMain, net } = require('electron');
const log = require('electron-log');

function registerNetHandlers() {
  ipcMain.handle('proxy-net-request', async (event, options) => {
    try {
      const { method = 'GET', url, headers = {}, body, timeout = 30000 } = options;

      return new Promise((resolve) => {
        const request = net.request({ method, url });

        for (const [key, value] of Object.entries(headers)) {
          request.setHeader(key, value);
        }

        const timer = setTimeout(() => {
          request.abort();
          resolve({ error: '请求超时' });
        }, timeout);

        request.on('response', (response) => {
          let data = '';
          response.on('data', (chunk) => { data += chunk.toString(); });
          response.on('end', () => {
            clearTimeout(timer);
            resolve({
              responseText: data,
              status: response.statusCode,
              statusText: response.statusMessage,
              readyState: 4,
              responseHeaders: response.headers,
            });
          });
        });

        request.on('error', (err) => {
          clearTimeout(timer);
          resolve({ error: err.message });
        });

        if (body) request.write(body);
        request.end();
      });
    } catch (error) {
      log.error('网络请求代理失败:', error);
      return { error: error.message };
    }
  });
}

module.exports = { registerNetHandlers };
