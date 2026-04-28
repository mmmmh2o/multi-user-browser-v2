import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Space, Popconfirm, message, Empty } from 'antd';
import { HistoryOutlined, DeleteOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';

export default function History() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try { setHistory((await safeCall(() => window.electronAPI.getHistory(), [])) || []); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleDelete = async (id) => {
    await window.electronAPI.deleteHistory(id);
    loadHistory();
  };

  const handleClear = async () => {
    await window.electronAPI.clearHistory();
    message.success('已清空');
    loadHistory();
  };

  const filtered = history.filter((h) =>
    (h.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.url || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { title: '标题', dataIndex: 'title', render: (t, r) => <a href={r.url} target="_blank" rel="noreferrer">{t || r.url}</a> },
    { title: '网址', dataIndex: 'url', ellipsis: true },
    { title: '时间', dataIndex: 'timestamp', width: 160, render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '-' },
    {
      title: '操作', width: 80, align: 'right',
      render: (_, r) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={<span className="mub-card-title"><CardIcon icon={<HistoryOutlined />} color="#722ed1" /><span>历史记录</span></span>}
      extra={
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="搜索历史..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
          <Popconfirm title="确定清空所有历史？" onConfirm={handleClear}>
            <Button danger icon={<ClearOutlined />}>清空</Button>
          </Popconfirm>
        </Space>
      }
    >
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="暂无历史记录" /> }} />
    </Card>
  );
}
