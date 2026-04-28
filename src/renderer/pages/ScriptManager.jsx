import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Popconfirm, message, Empty, Tag, Switch, Modal, Form, Input } from 'antd';
import { CodeOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';

export default function ScriptManager() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadScripts = async () => {
    setLoading(true);
    try { setScripts((await safeCall(() => window.electronAPI.getScripts(), [])) || []); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadScripts(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const script = editing ? { ...editing, ...values } : { ...values, enabled: true };
      await window.electronAPI.saveScript(script);
      message.success(editing ? '已更新' : '已创建');
      setModalOpen(false); form.resetFields(); setEditing(null);
      loadScripts();
    } catch { message.error('保存失败'); }
  };

  const handleDelete = async (id) => {
    await window.electronAPI.deleteScript(id);
    message.success('已删除');
    loadScripts();
  };

  const handleToggle = async (script) => {
    await window.electronAPI.saveScript({ ...script, enabled: !script.enabled });
    loadScripts();
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name',
      render: (name, r) => <span style={{ fontWeight: 600 }}>{name || '未命名脚本'}</span>,
    },
    { title: '匹配', dataIndex: 'match', ellipsis: true, render: (m) => m || '*' },
    {
      title: '状态', dataIndex: 'enabled', width: 80,
      render: (enabled, r) => <Switch checked={enabled} size="small" onChange={() => handleToggle(r)} />,
    },
    {
      title: '操作', width: 140, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r); form.setFieldsValue(r); setModalOpen(true);
          }} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={<span className="mub-card-title"><CardIcon icon={<CodeOutlined />} color="#13c2c2" /><span>脚本管理</span></span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建脚本</Button>}
      >
        <Table columns={columns} dataSource={scripts} rowKey="id" loading={loading} pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无脚本，支持 UserScript 格式" /> }} />
      </Card>

      <Modal title={editing ? '编辑脚本' : '新建脚本'} open={modalOpen} onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }} okText="保存" cancelText="取消" width={640}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="脚本名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：去广告助手" />
          </Form.Item>
          <Form.Item name="match" label="匹配 URL">
            <Input placeholder="例如：*://*.example.com/*（留空匹配所有）" />
          </Form.Item>
          <Form.Item name="code" label="脚本代码" rules={[{ required: true, message: '请输入代码' }]}>
            <Input.TextArea rows={12} placeholder="// ==UserScript==\n// @name     My Script\n// @match    *://*/*\n// ==/UserScript==\n\nconsole.log('Hello!');" style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
