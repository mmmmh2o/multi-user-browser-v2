# Multi-User Browser v2

> 基于 Electron BrowserView 的多用户并发管理桌面浏览器 — v2 全面重写

## ✨ v2 改进

| 特性 | v1 (webview) | v2 (BrowserView) |
|------|-------------|-------------------|
| 渲染方式 | `<webview>` 标签 | BrowserView (独立进程) |
| 性能 | 一般 | 接近原生 |
| 内存管理 | webview 销毁不彻底 | BrowserView 完全销毁 |
| 新窗口拦截 | 多层 fallback | setWindowOpenHandler 统一处理 |
| 下载拦截 | session 级别 | 同 v1 |
| 容器隔离 | partition 属性 | session.fromPartition() |

## 🚀 快速开始

```bash
git clone https://github.com/mmmmh2o/multi-user-browser-v2.git
cd multi-user-browser-v2
npm install
npm run dev
```

## 📁 项目结构

```
src/
├── main/                          # Electron 主进程
│   ├── index.js                   # BrowserView 管理器 + 窗口创建
│   ├── ipc/                       # IPC Handlers
│   │   ├── containerHandlers.js   # 容器 CRUD
│   │   ├── bookmarkHandlers.js    # 书签 CRUD
│   │   ├── historyHandlers.js     # 历史记录
│   │   ├── fileHandlers.js        # 文件操作
│   │   ├── scriptHandlers.js      # 脚本管理
│   │   ├── settingsHandlers.js    # 设置
│   │   └── netHandlers.js         # 网络代理
│   ├── preload/
│   │   └── browser-view-preload.js # BrowserView 注入脚本
│   └── utils/
│       └── pathValidator.js       # 路径安全校验
├── preload/
│   └── index.js                   # contextBridge API
├── renderer/                      # React 渲染进程
│   ├── pages/
│   │   ├── Browser.jsx            # 浏览器 UI（纯 UI 层）
│   │   ├── ContainerManager.jsx   # 容器管理
│   │   ├── Bookmarks.jsx          # 书签
│   │   ├── History.jsx            # 历史
│   │   ├── FileManager.jsx        # 文件管理
│   │   ├── ScriptManager.jsx      # 脚本管理
│   │   └── Settings.jsx           # 设置
│   └── ...
└── shared/
    └── constants.js               # 共享常量
```

## 🏗 架构

```
渲染进程 (Browser.jsx)          主进程 (index.js)
  标签栏 UI  ──IPC──→  BrowserView 管理器
  地址栏    ──IPC──→  view.webContents.loadURL()
  导航按钮  ──IPC──→  view.webContents.goBack()...
                        ↕
                     BrowserView × N (独立进程)
                     session.fromPartition(partition)
```

## 📄 License

[MIT](./LICENSE) · [mmmmh2o](https://github.com/mmmmh2o)
