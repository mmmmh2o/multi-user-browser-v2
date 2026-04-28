import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button, Space, Tabs, Dropdown, Spin, Tooltip, Empty, message, Tag,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  HomeOutlined, LockOutlined, GlobalOutlined, StarOutlined,
  CloseCircleOutlined, CopyOutlined,
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
  const activeTabKeyRef = useRef(null);
  useEffect(() => { activeTabKeyRef.current = activeTabKey; }, [activeTabKey]);

  // ========== 初始化 ==========
  useEffect(() => {
    loadContainers();
    loadHomepage().then((home) => addNewTab(home));
    window.electronAPI?.getSettings?.().then((s) => {
      if (s?.searchEngine) setSearchEngine(s.searchEngine);
    }).catch(() => {});

    // 监听 BrowserView 事件
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
      // 记录历史
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
        const tab = tabs.find((t) => t.key === tabId);
        if (tab?.url) window.electronAPI?.navigateBrowserView?.(tabId, tab.url);
      }, 1000);
    });

    return () => {
      window.electronAPI?.removeAllListeners?.('bv:title-updated');
      window.electronAPI?.removeAllListeners?.('bv:favicon-updated');
      window.electronAPI?.removeAllListeners?.('bv:loading');
      window.electronAPI?.removeAllListeners?.('bv:navigated');
      window.electronAPI?.removeAllListeners?.('bv:load-error');
      window.electronAPI?.removeAllListeners?.('bv:open-new-tab');
      window.electronAPI?.removeAllListeners?.('bv:crashed');
    };
  }, []);

  // ========== 数据加载 ==========
  const loadContainers = async () => {
    try { setContainers((await window.electronAPI.getContainers()) || []); }
    catch (e) { console.error('加载容器失败:', e); }
  };

  const loadHomepage = async () => {
    try { return (await window.electronAPI.getSettings())?.homepage || 'about:blank'; }
    catch { return 'about:blank'; }
  };

  // ========== 标签管理（通过 IPC 操作主进程 BrowserView） ==========

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

    // 通知主进程创建 BrowserView
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
        // 切换到新活跃标签的 BrowserView
        window.electronAPI.switchBrowserView(newActive);
      }

      return next;
    });

    // 通知主进程销毁 BrowserView
    await window.electronAPI.closeBrowserView(targetKey);
  }, [activeTabKey, addNewTab]);

  const switchTab = useCallback(async (key) => {
    setActiveTabKey(key);
    const tab = tabs.find((t) => t.key === key);
    if (tab) {
      setAddress(tab.url === NEW_TAB_URL ? '' : tab.url);
      // 通知主进程切换 BrowserView
      await window.electronAPI.switchBrowserView(key);
    }
  }, [tabs]);

  const setTabContainer = useCallback((tabKey, containerId) => {
    const container = containers.find((c) => c.id === containerId) || { id: 'default', name: '默认', color: '#8c8c8c' };
    setTabs((prev) => prev.map((t) =>
      t.key === tabKey ? { ...t, containerId, containerName: container.name, containerColor: container.color } : t
    ));
    // 容器切换需要重建 BrowserView
    const tab = tabs.find((t) => t.key === tabKey);
    if (tab && tab.url !== NEW_TAB_URL && tab.url !== 'about:blank') {
      window.electronAPI.closeBrowserView(tabKey);
      window.electronAPI.createBrowserView(tabKey, tab.url, containerId);
    }
  }, [tabs, containers]);

  // ========== 导航操作（通过 IPC 控制主进程 BrowserView） ==========

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

    // 通过 IPC 让主进程 BrowserView 导航
    const tab = tabs.find((t) => t.key === activeTabKey);
    if (tab && tab.url !== NEW_TAB_URL && tab.url !== 'about:blank') {
      window.electronAPI.navigateBrowserView(activeTabKey, url);
    } else {
      // 从空白页导航 → 需要创建 BrowserView
      window.electronAPI.createBrowserView(activeTabKey, url, tab?.containerId || 'default');
    }
  }, [activeTabKey, searchEngine, tabs]);

  const handleGoBack = useCallback(() => { window.electronAPI.bvGoBack(activeTabKey); }, [activeTabKey]);
  const handleGoForward = useCallback(() => { window.electronAPI.bvGoForward(activeTabKey); }, [activeTabKey]);
  const handleReload = useCallback(() => { window.electronAPI.bvReload(activeTabKey); }, [activeTabKey]);
  const handleStop = useCallback(() => { window.electronAPI.bvStop(activeTabKey); }, [activeTabKey]);
  const handleGoHome = useCallback(async () => { handleNavigate(await loadHomepage()); }, [handleNavigate]);

  const handleBookmark = useCallback(async () => {
    const tab = tabs.find((t) => t.key === activeTabKey);
    if (!tab || tab.url === NEW_TAB_URL || tab.url === 'about:blank') { message.warning('无法收藏空白页'); return; }
    try {
      await window.electronAPI.saveBookmark({ title: tab.title, url: tab.url, favicon: tab.favicon });
      message.success('已添加书签');
    } catch { message.error('收藏失败'); }
  }, [tabs, activeTabKey]);

  // ========== 地址栏快捷键 ==========
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
        setTabs((prev) => prev.filter((t) => t.key === key));
        setActiveTabKey(key);
      }},
      { key: 'close-right', label: '关闭右侧标签', onClick: () => {
        setTabs((prev) => { const idx = prev.findIndex((t) => t.key === key); return prev.slice(0, idx + 1); });
      }},
      { type: 'divider' },
      { key: 'duplicate', label: '复制标签', icon: <CopyOutlined />, onClick: () => { if (tab) addNewTab(tab.url, tab.containerId); } },
    ];
  }, [tabs, containers, addNewTab, setTabContainer]);

  // ========== 渲染 ==========
  const activeTab = tabs.find((t) => t.key === activeTabKey);
  const isSecure = activeTab?.url?.startsWith('https://');

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
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--mub-border-light)',
        background: '#fff',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--mub-bg)', borderRadius: 8, padding: 2,
        }}>
          <Tooltip title="后退">
            <Button size="small" type="text" icon={<ArrowLeftOutlined />}
              disabled={!activeTab?.canGoBack} onClick={handleGoBack}
              style={{ borderRadius: 6, width: 30, height: 30 }} />
          </Tooltip>
          <Tooltip title="前进">
            <Button size="small" type="text" icon={<ArrowRightOutlined />}
              disabled={!activeTab?.canGoForward} onClick={handleGoForward}
              style={{ borderRadius: 6, width: 30, height: 30 }} />
          </Tooltip>
          <Tooltip title={activeTab?.isLoading ? '停止' : '刷新'}>
            <Button size="small" type="text"
              icon={<ReloadOutlined spin={activeTab?.isLoading} />}
              onClick={activeTab?.isLoading ? handleStop : handleReload}
              style={{ borderRadius: 6, width: 30, height: 30 }} />
          </Tooltip>
          <Tooltip title="主页">
            <Button size="small" type="text" icon={<HomeOutlined />} onClick={handleGoHome}
              style={{ borderRadius: 6, width: 30, height: 30 }} />
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
          <Tooltip title="切换当前标签身份">
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
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleAddressKeyDown}
            onFocus={(e) => e.target.select()}
            placeholder="输入网址或搜索..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--mub-text)', lineHeight: '32px',
            }}
          />
        </div>

        <Tooltip title="收藏">
          <Button size="small" type="text" icon={<StarOutlined />} onClick={handleBookmark}
            style={{ borderRadius: 6, width: 32, height: 32 }} />
        </Tooltip>
      </div>

      {/* ─── BrowserView 占位区域 ─── */}
      {/* BrowserView 由主进程渲染，覆盖在此 div 之上 */}
      <div id="browser-view-host" style={{ flex: 1, position: 'relative', background: '#fff' }}>
        {tabs.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="点击 + 新建标签页">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => addNewTab()}>新建标签</Button>
            </Empty>
          </div>
        ) : (
          /* 空白页 / 新标签页 由渲染进程自己显示，有 URL 的标签由主进程 BrowserView 覆盖 */
          tabs.map((tab) => (
            tab.url === NEW_TAB_URL || tab.url === 'about:blank' ? (
              <div key={tab.key} style={{
                display: tab.key === activeTabKey ? 'flex' : 'none',
                width: '100%', height: '100%', flexDirection: 'column',
              }}>
                <NewTabPage onNavigate={handleNavigate} />
              </div>
            ) : null
          ))
        )}
      </div>
    </div>
  );
}

/* ─── 新标签页 ─── */
function NewTabPage({ onNavigate }) {
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
      justifyContent: 'center', gap: 36,
      background: 'linear-gradient(160deg, #f8f9fc 0%, #eef1f6 50%, #e8ecf4 100%)',
      padding: 48,
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
    </div>
  );
}
