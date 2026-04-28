import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.less';

createRoot(document.getElementById('root')).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#4f6ef7',
        borderRadius: 8,
        fontSize: 13,
      },
      algorithm: theme.defaultAlgorithm,
    }}
  >
    <App />
  </ConfigProvider>,
);
