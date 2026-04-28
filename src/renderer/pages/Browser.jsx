import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button, Space, Tabs, Dropdown, Spin, Tooltip, Empty, message, Tag, Badge, Progress, Drawer,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  HomeOutlined, LockOutlined, GlobalOutlined, StarOutlined,
  CloseCircleOutlined, CopyOutlined, SearchOutlined, ZoomInOutlined,
  ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined,
  PrinterOutlined, BugOutlined, DownloadOutlined, BellOutlined,
  CloseOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import ContainerDot from '../components/ContainerDot';

const HOME_URL = 'about:blank';
const NEW_TAB_URL = 'about:blank';

const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
};

export default function Browser() {
  const [tabs, setTabs] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState(null);
  const [address, setAddress] = useState('');
  const [containers, setContainers] = useState([]);
  const [searchEngine, setSearchEngine] = useState('google');
  const [zoomLevel, setZoomLevel] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [findText, setFindText] = useState('');
  const [downloads, setDownloads] = useState([]);
  const [downloadDrawerOpen, setDownloadDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const activeTabKeyRef = useRef(null);
  const findInputRef = useRef(null);

  useEffect(() => { activeTabKeyRef.current = activeTabKey; }, [activeTabKey]);

  // ========== 初始化 ==========
  useEffect(() => {
    loadContainers();
    loadHomepage().then((home) => addNewTab(home));
    loadBookmarks();

    window.electronAPI?.getSettings?.().then((s) => {
      if (s?.searchEngine) setSearchEngine(s.searchEngine);
    }).catch(() => {});

    // 尝试恢复会话
    window.electronAPI?.bvLoadSession?.().then((session) => {
      if (session?.tabs?.length > 0) {
        // 会话恢复由首页加载替代，此处记录
        console.log('[会话] 发现保存的标签:', session.tabs.length);
      }
    }).catch(() => {});

    // ========== BrowserView 事件监听 ==========
    window.electronAPI?.onBvTitleUpdated?.(({ tabId, title }) => {
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, title } : t));
    });
    window.electronAPI?.onBvFaviconUpdated?.(({ tabId, favicon }) => {
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, favicon } : t));
    });
    window.electronAPI?.onBvLoading?.(({ tabId, loading }) => {
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, isLoading: loading } : t));
    });
    window.electronAPI?.onBvNavigated?.(({ tabId, url, canGoBack, canGoForward }) => {
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, url, canGoBack, canGoForward } : t));
      if (tabId === activeTabKeyRef.current) setAddress(url);
      window.electronAPI?.addHistory?.({ url, title: url });
    });
    window.electronAPI?.onBvLoadError?.(({ tabId, errorDesc }) => {
      message.error(`加载失败: ${errorDesc}`);
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, isLoading: false } : t));
    });
    window.electronAPI?.onBvOpenNewTab?.(({ url, containerId }) => {
      addNewTab(url, containerId);
    });
    window.electronAPI?.onBvCrashed?.(({ tabId }) => {
      message.warning('页面崩溃，正在恢复...');
      setTabs((prev) => prev.map((t) => t.key === tabId ? { ...t, isLoading: true, title: '正在恢复...' } : t));
      setTimeout(() => {
        const tab = tabsRef.current.find((t) => t.key === tabId);
        if (tab?.url) window.electronAPI?.navigateBrowserView?.(tabId, tab.url);
      }, 1000);
    });
    window.electronAPI?.onBvFullscreen?.(({ fullscreen }) => setIsFullscreen(fullscreen));

    // 下载事件
    window.electronAPI?.onBvDownloadStarted?.((dl) => {
      setDownloads((prev) => [dl, ...prev.filter((d) => d.id !== dl.id)]);
      message.info(`开始下载: ${dl.filename}`);
    });
    window.electronAPI?.onBvDownloadProgress?.((dl) => {
      setDownloads((prev) => prev.map((d) => d.id === dl.id ? { ...d, ...dl } : d));
    });
    window.electronAPI?.onBvDownloadCompleted?.((dl) => {
      setDownloads((prev) => prev.map((d) => d.id === dl.id ? { ...d, ...dl } : d));
      if (dl.state === 'completed') message.success(`下载完成: ${dl.filename}`);
    });

    // 通知事件
    window.electronAPI?.onBvNotification?.((n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
    });

    // ========== 菜单快捷键事件 ==========
    window.electronAPI?.onMenuNewTab?.(() => addNewTab());
    window.electronAPI?.onMenuCloseTab?.(() => { if (activeTabKey) closeTab(activeTabKey); });
    window.electronAPI?.onMenuReload?.(() => handleReload());
    window.electronAPI?.onMenuForceReload?.(() => { window.electronAPI?.bvReload?.(activeTabKey); });
    window.electronAPI?.onMenuZoomIn?.(() => handleZoomIn());
    window.electronAPI?.onMenuZoomOut?.(() => handleZoomOut());
    window.electronAPI?.onMenuZoomReset?.(() => handleZoomReset());
    window.electronAPI?.onMenuFind?.(() => { setFindVisible(true); setTimeout(() => findInputRef.current?.focus(), 100); });
    window.electronAPI?.onMenuDevtools?.(() => window.electronAPI?.bvToggleDevtools?.(activeTabKey));
    window.electronAPI?.onMenuFullscreen?.(() => window.electronAPI?.bvToggleFullscreen?.());
    window.electronAPI?.onMenuGoBack?.(() => handleGoBack());
    window.electronAPI?.onMenuGoForward?.(() => handleGoForward());
    window.electronAPI?.onMenuHistory?.(() => { window.location.hash = '#/history'; });
    window.electronAPI?.onMenuPrint?.(() => window.electronAPI?.bvPrint?.(activeTabKey));
    window.electronAPI?.onMenuAbout?.(() => {
      message.info('Multi-User Browser v2 — 基于 Electron BrowserView');
    });

    // ========== 键盘快捷键 ==========
    const handleKeyDown = (e) => {
      // Ctrl+T 新标签
      if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); addNewTab(); }
      // Ctrl+W 关闭标签
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') { e.preventDefault(); if (activeTabKey) closeTab(activeTabKey); }
      // Ctrl+L 聚焦地址栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); document.querySelector('.mub-address-input')?.focus(); }
      // Ctrl+F 查找
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setFindVisible(true); setTimeout(() => findInputRef.current?.focus(), 100); }
      // Escape 关闭查找
      if (e.key === 'Escape') { setFindVisible(false); setFindText(''); window.electronAPI?.bvStopFind?.(activeTabKey, 'clearSelection'); }
      // Ctrl+Tab 下一个标签 / Ctrl+Shift+Tab 上一个标签
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.key === activeTabKey);
        if (idx !== -1) {
          const next = e.shiftKey
            ? tabs[(idx - 1 + tabs.length) % tabs.length]
            : tabs[(idx + 1) % tabs.length];
          switchTab(next.key);
        }
      }
      // Ctrl+1-9 切换到第N个标签
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) switchTab(tabs[idx].key);
      }
      // F5 刷新
      if (e.key === 'F5') { e.preventDefault(); handleReload(); }
      // F11 全屏
      if (e.key === 'F11') { e.preventDefault(); window.electronAPI?.bvToggleFullscreen?.(); }
      // F12 DevTools
      if (e.key === 'F12') { e.preventDefault(); window.electronAPI?.bvToggleDevtools?.(activeTabKey); }
      // Alt+Left/Right 前进后退
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); handleGoBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); handleGoForward(); }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ['bv:title-updated', 'bv:favicon-updated', 'bv:loading', 'bv:navigated',
       'bv:load-error', 'bv:open-new-tab', 'bv:crashed', 'bv:fullscreen',
       'bv:download-started', 'bv:download-progress', 'bv:download-completed',
       'bv:notification'].forEach((ch) => window.electronAPI?.removeAllListeners?.(ch));
      ['menu:new-tab', 'menu:close-tab', 'menu:reload', 'menu:force-reload',
       'menu:zoom-in', 'menu:zoom-out', 'menu:zoom-reset', 'menu:find',
       'menu:devtools', 'menu:fullscreen', 'menu:go-back', 'menu:go-forward',
       'menu:history', 'menu:print', 'menu:about'].forEach((ch) => window.electronAPI?.removeAllListeners?.(ch));
    };
  }, []);

  // tabs ref for event handlers
  const tabsRef = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // ========== 数据加载 ==========
  const loadContainers = async () => {
    try { setContainers((await window.electronAPI.getContainers()) || []); }
    catch (e) { console.error('加载容器失败:', e); }
  };

  const loadHomepage = async () => {
    try { return (await window.electronAPI.getSettings())?.homepage || 'about:blank'; }
    catch { return 'about:blank'; }
  };

  const loadBookmarks = async () => {
    try { setBookmarks((await window.electronAPI.getBookmarks()) || []); }
    catch {}
  };

  // ========== 会话保存 ==========
  const saveSession = useCallback(() => {
    const sessionTabs = tabs.map((t) => ({
      key: t.key, url: t.url, containerId: t.containerId, title: t.title,
    }));
    window.electronAPI?.bvSaveSession?.(sessionTabs);
  }, [tabs]);

  // 标签变化时自动保存
  useEffect(() => {
    if (tabs.length > 0) saveSession();
  }, [tabs, saveSession]);

  // ========== 标签管理 ==========

  const addNewTab = useCallback(async (url = NEW_TAB_URL, containerId = 'default') => {
    const key = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const container = containers.find((c) => c.id === containerId) || { id: 'default', name: '默认', color: '#8c8c8c' };
    const newTab = {
      key, title: '新标签页', url, containerId,
      containerName: container.name, containerColor: container.color,
      isLoading: false, canGoBack: false, canGoForward: false, favicon: null,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabKey(key);
    setAddress(url === NEW_TAB_URL ? '' : url);

    if (url !== NEW_TAB_URL && url !== 'about:blank') {
      await window.electronAPI.createBrowserView(key, url, containerId);
    }

    return key;
  }, [containers]);

  const closeTab = useCallback(async (targetKey) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === targetKey);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.key !== targetKey);

      if (activeTabKey === targetKey) {
        if (next.length === 0) {
          setTimeout(() => addNewTab(), 0);
          return next;
        }
        const newIdx = Math.min(idx, next.length - 1);
        const newActive = next[newIdx].key;
        setActiveTabKey(newActive);
        setAddress(next[newIdx].url === NEW_TAB_URL ? '' : next[newIdx].url);
        window.electronAPI.switchBrowserView(newActive);
      }

      return next;
    });

    await window.electronAPI.closeBrowserView(targetKey);
  }, [activeTabKey, addNewTab]);

  const switchTab = useCallback(async (key) => {
    setActiveTabKey(key);
    const tab = tabs.find((t) => t.key === key);
    if (tab) {
      setAddress(tab.url === NEW_TAB_URL ? '' : tab.url);
      await window.electronAPI.switchBrowserView(key);
      // 更新缩放
      const zoom = await window.electronAPI?.bvGetZoom?.(key);
      if (zoom !== undefined) setZoomLevel(zoom);
    }
  }, [tabs]);

  const setTabContainer = useCallback((tabKey, containerId) => {
    const container = containers.find((c) => c.id === containerId) || { id: 'default', name: '默认', color: '#8c8c8c' };
    setTabs((prev) => prev.map((t) =>
      t.key === tabKey ? { ...t, containerId, containerName: container.name, containerColor: container.color } : t
    ));
    const tab = tabs.find((t) => t.key === tabKey);
    if (tab && tab.url !== NEW_TAB_URL && tab.url !== 'about:blank') {
      window.electronAPI.closeBrowserView(tabKey);
      window.electronAPI.createBrowserView(tabKey, tab.url, containerId);
    }
  }, [tabs, containers]);

  // ========== 导航 ==========

  const handleNavigate = useCallback((input) => {
    if (!input.trim()) return;
    let url = input.trim();
    if (url === 'about:blank') { /* ok */ }
    else if (/^https?:\/\//i.test(url)) { /* full URL */ }
    else if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(url)) url = `https://${url}`;
    else {
      const engineUrl = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google;
      url = `${engineUrl}${encodeURIComponent(url)}`;
    }

    setTabs((prev) => prev.map((t) => t.key === activeTabKey ? { ...t, url, isLoading: true } : t));
    setAddress(url);

    const tab = tabs.find((t) => t.key === activeTabKey);
    if (tab && tab.url !== NEW_TAB_URL && tab.url !== 'about:blank') {
      window.electronAPI.navigateBrowserView(activeTabKey, url);
    } else {
      window.electronAPI.createBrowserView(activeTabKey, url, tab?.containerId || 'default');
    }
  }, [activeTabKey, searchEngine, tabs]);

  const handleGoBack = useCallback(() => { window.electronAPI.bvGoBack(activeTabKey); }, [activeTabKey]);
  const handleGoForward = useCallback(() => { window.electronAPI.bvGoForward(activeTabKey); }, [activeTabKey]);
  const handleReload = useCallback(() => { window.electronAPI.bvReload(activeTabKey); }, [activeTabKey]);
  const handleStop = useCallback(() => { window.electronAPI.bvStop(activeTabKey); }, [activeTabKey]);
  const handleGoHome = useCallback(async () => { handleNavigate(await loadHomepage()); }, [handleNavigate]);

  // ========== 缩放 ==========
  const handleZoomIn = useCallback(async () => {
    await window.electronAPI?.bvZoomIn?.(activeTabKey);
    const zoom = await window.electronAPI?.bvGetZoom?.(activeTabKey);
    setZoomLevel(zoom || 0);
  }, [activeTabKey]);

  const handleZoomOut = useCallback(async () => {
    await window.electronAPI?.bvZoomOut?.(activeTabKey);
    const zoom = await window.electronAPI?.bvGetZoom?.(activeTabKey);
    setZoomLevel(zoom || 0);
  }, [activeTabKey]);

  const handleZoomReset = useCallback(async () => {
    await window.electronAPI?.bvZoomReset?.(activeTabKey);
    setZoomLevel(0);
  }, [activeTabKey]);

  // ========== 查找 ==========
  const handleFind = useCallback((text, forward = true) => {
    if (text) {
      window.electronAPI?.bvFindInPage?.(activeTabKey, text, forward);
    } else {
      window.electronAPI?.bvStopFind?.(activeTabKey, 'clearSelection');
    }
  }, [activeTabKey]);

  const handleFindKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleFind(findText, !e.shiftKey);
    }
    if (e.key === 'Escape') {
      setFindVisible(false);
      setFindText('');
      window.electronAPI?.bvStopFind?.(activeTabKey, 'clearSelection');
    }
  }, [findText, activeTabKey, handleFind]);

  // ========== 书签 ==========
  const handleBookmark = useCallback(async () => {
    const tab = tabs.find((t) => t.key === activeTabKey);
    if (!tab || tab.url === NEW_TAB_URL || tab.url === 'about:blank') { message.warning('无法收藏空白页'); return; }
    try {
      await window.electronAPI.saveBookmark({ title: tab.title, url: tab.url, favicon: tab.favicon });
      message.success('已添加书签');
      loadBookmarks();
    } catch { message.error('收藏失败'); }
  }, [tabs, activeTabKey]);

  const isBookmarked = bookmarks.some((b) => b.url === tabs.find((t) => t.key === activeTabKey)?.url);

  // ========== 地址栏 ==========
  const handleAddressKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleNavigate(address);
    if (e.key === 'Escape') { const tab = tabs.find((t) => t.key === activeTabKey); if (tab) setAddress(tab.url === NEW_TAB_URL ? '' : tab.url); }
  }, [address, handleNavigate, activeTabKey, tabs]);

  // ========== 右键菜单 ==========
  const getTabMenuItems = useCallback((key) => {
    const tab = tabs.find((t) => t.key === key);
    const containerItems = containers.map((c) => ({
      key: `container-${c.id}`,
      label: (<span><ContainerDot color={c.color} size={8} style={{ marginRight: 8 }} />{c.name}</span>),
      onClick: () => setTabContainer(key, c.id),
    }));
    return [
      { key: 'container', label: '切换身份', children: containerItems },
      { type: 'divider' },
      { key: 'close-others', label: '关闭其他标签', icon: <CloseCircleOutlined />, onClick: () => {
        const keep = tabs.find((t) => t.key === key);
        setTabs(keep ? [keep] : []);
        setActiveTabKey(key);
      }},
      { key: 'close-right', label: '关闭右侧标签', onClick: () => {
        setTabs((prev) => { const idx = prev.findIndex((t) => t.key === key); return prev.slice(0, idx + 1); });
      }},
      { type: 'divider' },
      { key: 'duplicate', label: '复制标签', icon: <CopyOutlined />, onClick: () => { if (tab) addNewTab(tab.url, tab.containerId); } },
    ];
  }, [tabs, containers, addNewTab, setTabContainer]);

  // ========== 下载格式化 ==========
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (received, startTime) => {
    if (!received || !startTime) return '';
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed < 1) return '';
    return `${formatBytes(received / elapsed)}/s`;
  };

  // ========== 渲染 ==========
  const activeTab = tabs.find((t) => t.key === activeTabKey);
  const isSecure = activeTab?.url?.startsWith('https://');
  const activeDownloads = downloads.filter((d) => d.state === 'downloading');
  const zoomPercent = Math.round(Math.pow(1.2, zoomLevel) * 100);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* ─── 标签栏 ─── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--mub-border-light)',
        background: 'var(--mub-bg-table-header)',
        minHeight: 38, paddingLeft: 8,
      }}>
        <Tabs
          type="editable-card"
          size="small"
          activeKey={activeTabKey}
          onChange={switchTab}
          onEdit={(targetKey, action) => {
            if (action === 'add') addNewTab();
            if (action === 'remove') closeTab(targetKey);
          }}
          hideAdd={false}
          items={tabs.map((tab) => ({
            key: tab.key,
            label: (
              <Dropdown menu={{ items: getTabMenuItems(tab.key) }} trigger={['contextMenu']}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 12.5,
                }}>
                  <ContainerDot color={tab.containerColor} size={10} title={tab.containerName || '默认'} />
                  {tab.isLoading
                    ? <Spin size="small" style={{ marginRight: 2 }} />
                    : tab.favicon
                      ? <img src={tab.favicon} alt="" style={{ width: 14, height: 14 }} />
                      : <GlobalOutlined style={{ fontSize: 11, color: '#bbb' }} />
                  }
                  {tab.title}
                </span>
              </Dropdown>
            ),
            closable: tabs.length > 1,
          }))}
          style={{ flex: 1, marginBottom: 0, marginLeft: 4 }}
          tabBarStyle={{ margin: 0 }}
        />
      </div>

      {/* ─── 导航栏 ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        borderBottom: '1px solid var(--mub-border-light)',
        background: '#fff',
      }}>
        {/* 导航按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--mub-bg)', borderRadius: 8, padding: 2 }}>
          <Tooltip title="后退 (Alt+←)">
            <Button size="small" type="text" icon={<ArrowLeftOutlined />}
              disabled={!activeTab?.canGoBack} onClick={handleGoBack}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>
          <Tooltip title="前进 (Alt+→)">
            <Button size="small" type="text" icon={<ArrowRightOutlined />}
              disabled={!activeTab?.canGoForward} onClick={handleGoForward}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>
          <Tooltip title={activeTab?.isLoading ? '停止' : '刷新 (F5)'}>
            <Button size="small" type="text"
              icon={<ReloadOutlined spin={activeTab?.isLoading} />}
              onClick={activeTab?.isLoading ? handleStop : handleReload}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>
          <Tooltip title="主页">
            <Button size="small" type="text" icon={<HomeOutlined />} onClick={handleGoHome}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>
        </div>

        {/* 容器选择器 */}
        <Dropdown
          menu={{
            items: containers.map((c) => ({
              key: c.id,
              label: (<span><ContainerDot color={c.color} size={10} style={{ marginRight: 8 }} />{c.name}</span>),
            })),
            onClick: ({ key }) => { if (activeTabKey) setTabContainer(activeTabKey, key); },
          }}
          trigger={['click']}
        >
          <Tooltip title="切换身份">
            <Tag style={{
              cursor: 'pointer', margin: 0, borderRadius: 16,
              lineHeight: '22px', padding: '1px 10px',
              fontSize: 'var(--mub-font-size-sm)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 5,
            }} color={activeTab?.containerColor || '#8c8c8c'}>
              <ContainerDot color={activeTab?.containerColor} size={8} />
              {activeTab?.containerName || '默认'}
            </Tag>
          </Tooltip>
        </Dropdown>

        {/* 地址栏 */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'var(--mub-bg)', borderRadius: 20,
          padding: '0 12px', height: 34,
          border: '1px solid transparent',
          transition: 'all 0.2s ease',
        }}>
          {isSecure
            ? <LockOutlined style={{ color: 'var(--mub-success)', fontSize: 12, marginRight: 6 }} />
            : <GlobalOutlined style={{ color: 'var(--mub-text-muted)', fontSize: 12, marginRight: 6 }} />
          }
          <input
            className="mub-address-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleAddressKeyDown}
            onFocus={(e) => e.target.select()}
            placeholder="输入网址或搜索... (Ctrl+L)"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--mub-text)', lineHeight: '32px',
            }}
          />
        </div>

        {/* 工具按钮组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={isBookmarked ? '已收藏' : '收藏'}>
            <Button size="small" type="text"
              icon={<StarOutlined style={{ color: isBookmarked ? '#faad14' : undefined }} />}
              onClick={handleBookmark}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>

          <Tooltip title={`缩放 ${zoomPercent}%`}>
            <Dropdown
              menu={{
                items: [
                  { key: 'in', label: '放大', icon: <ZoomInOutlined />, onClick: handleZoomIn },
                  { key: 'out', label: '缩小', icon: <ZoomOutOutlined />, onClick: handleZoomOut },
                  { key: 'reset', label: '重置 (100%)', onClick: handleZoomReset },
                ],
              }}
              trigger={['click']}
            >
              <Button size="small" type="text"
                icon={<span style={{ fontSize: 11, fontWeight: 600 }}>{zoomPercent}%</span>}
                style={{ borderRadius: 6, width: 40, height: 28, fontSize: 11 }} />
            </Dropdown>
          </Tooltip>

          <Tooltip title="下载管理">
            <Badge count={activeDownloads.length} size="small" offset={[-4, 4]}>
              <Button size="small" type="text" icon={<DownloadOutlined />}
                onClick={() => setDownloadDrawerOpen(true)}
                style={{ borderRadius: 6, width: 28, height: 28 }} />
            </Badge>
          </Tooltip>

          <Tooltip title="开发者工具 (F12)">
            <Button size="small" type="text" icon={<BugOutlined />}
              onClick={() => window.electronAPI?.bvToggleDevtools?.(activeTabKey)}
              style={{ borderRadius: 6, width: 28, height: 28 }} />
          </Tooltip>
        </div>
      </div>

      {/* ─── 查找栏 ─── */}
      {findVisible && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 12px',
          background: '#f6f6f6',
          borderBottom: '1px solid var(--mub-border-light)',
        }}>
          <SearchOutlined style={{ color: '#999' }} />
          <input
            ref={findInputRef}
            value={findText}
            onChange={(e) => { setFindText(e.target.value); handleFind(e.target.value); }}
            onKeyDown={handleFindKeyDown}
            placeholder="在页面中查找..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, lineHeight: '28px',
            }}
            autoFocus
          />
          <Button size="small" type="text" icon={<ArrowUpOutlined />}
            onClick={() => handleFind(findText, false)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />}
            onClick={() => handleFind(findText, true)} />
          <Button size="small" type="text" icon={<CloseOutlined />}
            onClick={() => { setFindVisible(false); setFindText(''); window.electronAPI?.bvStopFind?.(activeTabKey, 'clearSelection'); }} />
        </div>
      )}

      {/* ─── BrowserView 占位 ─── */}
      <div id="browser-view-host" style={{ flex: 1, position: 'relative', background: '#fff' }}>
        {tabs.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="点击 + 新建标签页 (Ctrl+T)">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => addNewTab()}>新建标签</Button>
            </Empty>
          </div>
        ) : (
          tabs.map((tab) => (
            tab.url === NEW_TAB_URL || tab.url === 'about:blank' ? (
              <div key={tab.key} style={{
                display: tab.key === activeTabKey ? 'flex' : 'none',
                width: '100%', height: '100%', flexDirection: 'column',
              }}>
                <NewTabPage onNavigate={handleNavigate} bookmarks={bookmarks} />
              </div>
            ) : null
          ))
        )}
      </div>

      {/* ─── 书签栏 ─── */}
      {bookmarks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 12px',
          borderTop: '1px solid var(--mub-border-light)',
          background: '#fafafa',
          overflow: 'auto',
          flexShrink: 0,
          minHeight: 28,
        }}>
          {bookmarks.slice(0, 20).map((b) => (
            <Tooltip key={b.id} title={b.url}>
              <Tag
                style={{ cursor: 'pointer', margin: 0, fontSize: 11, padding: '0 8px', lineHeight: '20px' }}
                onClick={() => handleNavigate(b.url)}
              >
                {b.favicon ? <img src={b.favicon} alt="" style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle' }} /> : null}
                {b.title?.slice(0, 15) || b.url?.replace(/https?:\/\//, '').slice(0, 15)}
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}

      {/* ─── 全屏提示 ─── */}
      {isFullscreen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 4,
          background: 'var(--mub-primary)', zIndex: 9999,
        }} />
      )}

      {/* ─── 下载抽屉 ─── */}
      <Drawer
        title={<span><DownloadOutlined style={{ marginRight: 8 }} />下载管理</span>}
        placement="right"
        width={380}
        open={downloadDrawerOpen}
        onClose={() => setDownloadDrawerOpen(false)}
        extra={
          <Button size="small" onClick={() => { window.electronAPI?.bvClearDownloads?.(); setDownloads([]); }}>
            清空
          </Button>
        }
      >
        {downloads.length === 0 ? (
          <Empty description="暂无下载" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {downloads.map((dl) => (
              <div key={dl.id} style={{
                padding: '10px 12px', background: '#fafafa', borderRadius: 8,
                border: '1px solid #f0f0f0',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dl.filename}
                  </span>
                  <Tag color={dl.state === 'completed' ? 'success' : dl.state === 'failed' ? 'error' : 'processing'} style={{ marginLeft: 8 }}>
                    {dl.state === 'completed' ? '完成' : dl.state === 'failed' ? '失败' : '下载中'}
                  </Tag>
                </div>
                {dl.state === 'downloading' && dl.totalBytes > 0 && (
                  <Progress
                    percent={Math.round((dl.receivedBytes / dl.totalBytes) * 100)}
                    size="small"
                    status="active"
                  />
                )}
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  {formatBytes(dl.receivedBytes)} / {formatBytes(dl.totalBytes)}
                  {dl.startTime && dl.state === 'downloading' && ` · ${formatSpeed(dl.receivedBytes, dl.startTime)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ─── 新标签页 ─── */
function NewTabPage({ onNavigate, bookmarks }) {
  const [searchValue, setSearchValue] = useState('');
  const quickLinks = [
    { title: 'Google', url: 'https://www.google.com', icon: '🔍', color: '#4285f4' },
    { title: 'GitHub', url: 'https://github.com', icon: '🐙', color: '#333' },
    { title: 'YouTube', url: 'https://www.youtube.com', icon: '📺', color: '#ff0000' },
    { title: '百度', url: 'https://www.baidu.com', icon: '🐻', color: '#2932e1' },
    { title: 'Bilibili', url: 'https://www.bilibili.com', icon: '🎮', color: '#fb7299' },
    { title: '知乎', url: 'https://www.zhihu.com', icon: '💡', color: '#0066ff' },
  ];

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 32,
      background: 'linear-gradient(160deg, #f8f9fc 0%, #eef1f6 50%, #e8ecf4 100%)',
      padding: 48, overflow: 'auto',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #4f6ef7 0%, #7c5cfc 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: '0 8px 24px rgba(79,110,247,0.3)',
        }}>🌐</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--mub-text)', letterSpacing: -0.5 }}>
          Multi-User Browser
        </div>
        <div style={{ color: 'var(--mub-text-muted)', marginTop: 6, fontSize: 13.5 }}>
          在地址栏输入网址，或点击下方快捷链接
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 480,
        background: '#fff', borderRadius: 24, padding: '0 20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid var(--mub-border-light)',
        display: 'flex', alignItems: 'center', height: 46,
      }}>
        <span style={{ fontSize: 16, marginRight: 10, opacity: 0.4 }}>🔍</span>
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && searchValue.trim()) onNavigate(searchValue.trim()); }}
          placeholder="搜索或输入网址..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: 'var(--mub-text)', lineHeight: '44px',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 480, width: '100%' }}>
        {quickLinks.map((link) => (
          <div
            key={link.url}
            onClick={() => onNavigate(link.url)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '18px 16px', background: 'rgba(255,255,255,0.8)',
              borderRadius: 14, cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              border: '1px solid rgba(255,255,255,0.9)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${link.color}18`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${link.color}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>{link.icon}</div>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--mub-text)' }}>{link.title}</span>
          </div>
        ))}
      </div>

      {/* 最近书签 */}
      {bookmarks?.length > 0 && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: 12, color: 'var(--mub-text-muted)', marginBottom: 8 }}>最近书签</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bookmarks.slice(0, 6).map((b) => (
              <Tag key={b.id} style={{ cursor: 'pointer', padding: '4px 12px' }} onClick={() => onNavigate(b.url)}>
                {b.title?.slice(0, 20) || b.url}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
