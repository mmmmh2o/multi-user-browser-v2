import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Input, message, Empty, Popconfirm, Breadcrumb } from 'antd';
import {
  FolderOutlined, FileOutlined, PlusOutlined, DeleteOutlined,
  EditOutlined, ArrowLeftOutlined,
} from 'antd/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingFile, setEditingFile] = useState(null);

  useEffect(() => {
    (async () => {
      const homeDir = await safeCall(() => window.electronAPI.getHomeDir(), '/');
      setCurrentPath(homeDir || '/');
    })();
  }, []);

  const loadFiles = useCallback(async (dirPath) => {
    if (!dirPath) return;
    setLoading(true);
    try {
      const data = await safeCall(() => window.electronAPI.getFiles(dirPath), []);
      setFiles(data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(currentPath); }, [currentPath, loadFiles]);

  const handleNavigate = (dirPath) => setCurrentPath(dirPath);

  const handleCreateDirectory = async () => {
    if (!newName.trim()) return;
    const sep = currentPath.includes('\\') ? '\\' : '/';
    const newPath = `${currentPath}${sep}${newName.trim()}`;
    const ok = await safeCall(() => window.electronAPI.createDirectory(newPath));
    if (ok) { message.success('已创建'); setNewName(''); loadFiles(currentPath); }
  };

  const handleDelete = async (filePath) => {
    const ok = await safeCall(() => window.electronAPI.deleteFile(filePath));
    if (ok) { message.success('已删除'); loadFiles(currentPath); }
  };

  const handleRename = async (oldPath) => {
    if (!editingFile?.newName) return;
    const sep = currentPath.includes('\\') ? '\\' : '/';
    const newPath = `${currentPath}${sep}${editingFile.newName}`;
    const ok = await safeCall(() => window.electronAPI.renameFile(oldPath, newPath));
    if (ok) { message.success('已重命名'); setEditingFile(null); loadFiles(currentPath); }
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name',
      render: (name, record) => record.isDirectory ? (
        <a onClick={() => handleNavigate(record.path)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOutlined style={{ color: '#faad14' }} /> {name}
        </a>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileOutlined style={{ color: '#8c8c8c' }} /> {name}
        </span>
      ),
    },
    { title: '大小', dataIndex: 'size', width: 100, render: (s) => s ? `${(s / 1024).toFixed(1)} KB` : '-' },
    {
      title: '操作', width: 140, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingFile({ path: record.path, newName: record.name })} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.path)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={<span className="mub-card-title"><CardIcon icon={<FolderOutlined />} color="#faad14" /><span>文件管理</span></span>}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => {
              const parent = currentPath.replace(/[/\\][^/\\]+$/, '') || '/';
              setCurrentPath(parent);
            }} />
            <Input placeholder="新文件夹名" value={newName} onChange={(e) => setNewName(e.target.value)}
              onPressEnter={handleCreateDirectory} style={{ width: 200 }} />
            <Button icon={<PlusOutlined />} onClick={handleCreateDirectory}>新建文件夹</Button>
          </Space>
        }
      >
        <Breadcrumb style={{ marginBottom: 16 }} items={
          currentPath.split(/[/\\]/).filter(Boolean).map((part, i, arr) => ({
            title: i === arr.length - 1 ? part : <a onClick={() => setCurrentPath('/' + arr.slice(0, i + 1).join('/'))}>{part}</a>,
          }))
        } />
        <Table columns={columns} dataSource={files} rowKey="path" loading={loading} pagination={false}
          locale={{ emptyText: <Empty description="空文件夹" /> }} />
      </Card>

      {editingFile && (
        <Card size="small" style={{ position: 'fixed', bottom: 20, right: 20, width: 300, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          title="重命名" extra={<Button type="text" size="small" onClick={() => setEditingFile(null)}>✕</Button>}>
          <Space>
            <Input value={editingFile.newName} onChange={(e) => setEditingFile({ ...editingFile, newName: e.target.value })}
              onPressEnter={() => handleRename(editingFile.path)} />
            <Button type="primary" size="small" onClick={() => handleRename(editingFile.path)}>确定</Button>
          </Space>
        </Card>
      )}
    </>
  );
}
