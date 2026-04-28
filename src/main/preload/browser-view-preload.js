/**
 * BrowserView Preload 脚本
 * 在每个 BrowserView 的页面加载前执行
 * 负责：UserScript 注入 + GM_* API + 新窗口拦截
 */

const { ipcRenderer } = require('electron');

// ========== 新窗口拦截 ==========
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (link && link.target === '_blank') {
    e.preventDefault();
    const url = link.href;
    if (url && !url.startsWith('javascript:')) {
      ipcRenderer.send('open-url-in-tab', url);
    }
  }
}, true);

const originalWindowOpen = window.open;
window.open = function(url, target, features) {
  if (url && target !== '_self' && target !== '_top' && target !== '_parent') {
    ipcRenderer.send('open-url-in-tab', url);
    return null;
  }
  return originalWindowOpen.call(window, url, target, features);
};

// ========== GM_* API ==========
function createGMApi(scriptId) {
  const storageKey = `gm_storage_${scriptId}`;

  return {
    GM_getValue: (key, defaultValue) => {
      try {
        const store = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return store[key] !== undefined ? store[key] : defaultValue;
      } catch { return defaultValue; }
    },
    GM_setValue: (key, value) => {
      try {
        const store = JSON.parse(localStorage.getItem(storageKey) || '{}');
        store[key] = value;
        localStorage.setItem(storageKey, JSON.stringify(store));
      } catch (e) { console.error('[MUB] GM_setValue 失败:', e); }
    },
    GM_deleteValue: (key) => {
      try {
        const store = JSON.parse(localStorage.getItem(storageKey) || '{}');
        delete store[key];
        localStorage.setItem(storageKey, JSON.stringify(store));
      } catch {}
    },
    GM_listValues: () => {
      try { return Object.keys(JSON.parse(localStorage.getItem(storageKey) || '{}')); }
      catch { return []; }
    },
    GM_log: (...args) => console.log(`[UserScript:${scriptId}]`, ...args),
    GM_xmlhttpRequest: (details) => {
      const fetchOptions = {
        method: details.method || 'GET',
        url: details.url,
        headers: details.headers || {},
        timeout: details.timeout || 30000,
      };
      if (details.data || details.body) fetchOptions.body = details.data || details.body;
      if (fetchOptions.body && !fetchOptions.headers['Content-Type'] && !fetchOptions.headers['content-type']) {
        fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      ipcRenderer.invoke('proxy-net-request', fetchOptions)
        .then((result) => {
          if (result.error) details.onerror?.(result.error);
          else details.onload?.({
            responseText: result.responseText,
            response: result.responseText,
            status: result.status,
            statusText: result.statusText,
            readyState: result.readyState,
            responseHeaders: result.responseHeaders,
          });
        })
        .catch((err) => details.onerror?.(err));
    },
    GM_addStyle: (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    },
  };
}

// ========== 脚本注入 ==========
function injectScript(code) {
  const script = document.createElement('script');
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function parseUserScriptMeta(code) {
  const meta = { name: '', match: [], exclude: [] };
  const metaBlock = code.match(/==UserScript==([\s\S]*?)==\/UserScript==/);
  if (!metaBlock) return meta;

  const lines = metaBlock[1].split('\n');
  for (const line of lines) {
    const m = line.match(/@(\w+)\s+(.+)/);
    if (m) {
      const [, key, value] = m;
      if (key === 'name') meta.name = value.trim();
      else if (key === 'match') meta.match.push(value.trim());
      else if (key === 'exclude') meta.exclude.push(value.trim());
    }
  }
  return meta;
}

function matchesPage(meta, url) {
  if (meta.match.length === 0) return true;
  return meta.match.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}

// ========== 主入口 ==========
async function main() {
  const currentUrl = window.location.href;
  if (currentUrl.startsWith('about:') || currentUrl.startsWith('chrome:') || currentUrl.startsWith('devtools:')) return;

  try {
    const scripts = await ipcRenderer.invoke('get-enabled-scripts');
    if (!scripts || scripts.length === 0) return;

    for (const script of scripts) {
      if (!script.code) continue;
      const meta = parseUserScriptMeta(script.code);
      if (!matchesPage(meta, currentUrl)) continue;

      const gmApi = createGMApi(script.id);
      for (const [key, value] of Object.entries(gmApi)) {
        window[key] = value;
      }
      injectScript(script.code);
    }
  } catch (err) {
    console.error('[MUB] 脚本加载失败:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
