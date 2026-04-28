import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Empty, Tag, Popconfirm, message, Progress } from 'antd';
import { DownloadOutlined, DeleteOutlined, ClearOutlined, ReloadOutlined } from '@ant-design/icons';
import CardIcon from '../components/CardIcon';

export default function DownloadManager() {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDownloads = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI?.bvGetDownloads?.();
      setDownloads(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadDownloads();

    window.electronAPI?.onBvDownloadStarted?.((dl) => {
      setDownloads((prev) => [dl, ...prev.filter((d) => d.id !== dl.id)]);
    });
    window.electronAPI?.onBvDownloadProgress?.((dl) => {
      setDownloads((prev) => prev.map((d) => d.id === dl.id ? { ...d, ...dl } : d));
    });
    window.electronAPI?.onBvDownloadCompleted?.((dl) => {
      setDownloads((prev) => prev.map((d) => d.id === dl.id ? { ...d, ...dl } : d));
    });

    return () => {
      window.electronAPI?.removeAllListeners?.('bv:download-started');
      window.electronAPI?.removeAllListeners?.('bv:download-progress');
      window.electronAPI?.removeAllListeners?.('bv:download-completed');
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleClear = async () => {
    await window.electronAPI?.bvClearDownloads?.();
    setDownloads([]);
    message.success('已清空');
  };

  const columns = [
    {
      title: '文件名', dataIndex: 'filename', ellipsis: true,
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '大小', width: 120,
      render: (_, r) => r.totalBytes > 0 ? formatBytes(r.totalBytes) : '未知',
    },
    {
      title: '进度', width: 160,
      render: (_, r) => {
        if (r.state === 'completed') return <Tag color="success">完成</Tag>;
        if (r.state === 'failed') return <Tag color="error">失败</Tag>;
        const percent = r.totalBytes > 0 ? Math.round((r.receivedBytes / r.totalBytes) * 100) : 0;
        return <Progress percent={percent} size="small" status="active" />;
      },
    },
    {
      title: '状态', dataIndex: 'state', width: 80,
      render: (state) => {
        const map = { completed: { color: 'success', text: '完成' }, downloading: { color: 'processing', text: '下载中' }, failed: { color: 'error', text: '失败' }, paused: { color: 'warning', text: '暂停' } };
        const s = map[state] || { color: 'default', text: state };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '时间', dataIndex: 'startTime', width: 140,
      render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <Card
      title={<span className="mub-card-title"><CardIcon icon={<DownloadOutlined />} color="#1677ff" /><span>下载管理</span></span>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDownloads}>刷新</Button>
          <Popconfirm title="确定清空所有下载记录？" onConfirm={handleClear}>
            <Button danger icon={<ClearOutlined />}>清空</Button>
          </Popconfirm>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={downloads}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="暂无下载记录" /> }}
      />
    </Card>
  );
}
