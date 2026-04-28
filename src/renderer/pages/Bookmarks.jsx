import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Space, Popconfirm, message, Empty } from 'antd';
import { StarOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBookmarks = async () => {
    setLoading(true);
    try { setBookmarks((await safeCall(() => window.electronAPI.getBookmarks(), [])) || []); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBookmarks(); }, []);

  const handleDelete = async (id) => {
    await window.electronAPI.deleteBookmark(id);
    message.success('已删除');
    loadBookmarks();
  };

  const filtered = bookmarks.filter((b) =>
    (b.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.url || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { title: '标题', dataIndex: 'title', render: (t, r) => <a href={r.url} target="_blank" rel="noreferrer">{t || r.url}</a> },
    { title: '网址', dataIndex: 'url', ellipsis: true },
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
      title={<span className="mub-card-title"><CardIcon icon={<StarOutlined />} color="#faad14" /><span>书签</span></span>}
      extra={<Input prefix={<SearchOutlined />} placeholder="搜索书签..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />}
    >
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="暂无书签" /> }} />
    </Card>
  );
}
