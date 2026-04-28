import React, { useState, useEffect } from 'react';
import { Badge, Dropdown, Empty, Button } from 'antd';
import { BellOutlined, ClearOutlined } from '@ant-design/icons';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    window.electronAPI?.onBvNotification?.((n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 30));
    });
    return () => window.electronAPI?.removeAllListeners?.('bv:notification');
  }, []);

  const unreadCount = notifications.length;

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => (
        <div style={{
          width: 320, maxHeight: 400, overflow: 'auto',
          background: '#fff', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>通知</span>
            {notifications.length > 0 && (
              <Button type="text" size="small" icon={<ClearOutlined />}
                onClick={() => setNotifications([])}>
                清空
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <Empty description="暂无通知" style={{ padding: '20px 0' }} />
          ) : (
            notifications.map((n, i) => (
              <div key={i} style={{
                padding: '8px 10px', borderRadius: 6,
                background: i === 0 ? '#f0f5ff' : 'transparent',
                marginBottom: 2,
              }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  {n.time ? new Date(n.time).toLocaleTimeString('zh-CN') : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 16, cursor: 'pointer', padding: '4px 8px' }} />
      </Badge>
    </Dropdown>
  );
}
