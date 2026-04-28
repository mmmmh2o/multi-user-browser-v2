import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Space, Popconfirm,
  message, Empty, Tag,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserSwitchOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';
import { PRESET_COLORS, DEFAULT_PAGINATION } from '../constants';

function ColorPicker({ value, onChange }) {
  return (
    <Space wrap size={8}>
      {PRESET_COLORS.map((c) => (
        <div key={c} onClick={() => onChange(c)} style={{
          width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
          border: value === c ? '3px solid var(--mub-text)' : '2px solid transparent',
          transition: 'all var(--mub-transition)', position: 'relative',
        }}>
          {value === c && (
            <CheckCircleFilled style={{
              position: 'absolute', top: -4, right: -4, fontSize: 14,
              color: 'var(--mub-text)', background: '#fff', borderRadius: '50%',
            }} />
          )}
        </div>
      ))}
    </Space>
  );
}

export default function ContainerManager() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [color, setColor] = useState('#4f6ef7');

  const loadContainers = async () => {
    setLoading(true);
    try {
      const data = await safeCall(() => window.electronAPI.getContainers(), []);
      setContainers(data || []);
    } catch { message.error('加载容器失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadContainers(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const container = editing ? { ...editing, ...values, color } : { ...values, color };
      await safeCall(() => window.electronAPI.saveContainer(container));
      message.success(editing ? '容器已更新' : '容器已创建');
      setModalOpen(false); form.resetFields(); setEditing(null);
      loadContainers();
    } catch { message.error('保存失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const result = await safeCall(() => window.electronAPI.deleteContainer(id));
      if (result?.error) message.error(result.error);
      else { message.success('容器已删除'); loadContainers(); }
    } catch { message.error('删除失败'); }
  };

  const columns = [
    {
      title: '', dataIndex: 'color', width: 52,
      render: (c) => (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: c || 'var(--mub-text-muted)',
          boxShadow: `0 2px 8px ${c || '#8c8c8c'}40`, border: '2px solid rgba(255,255,255,0.9)',
        }} />
      ),
    },
    {
      title: '名称', dataIndex: 'name',
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mub-space-sm)' }}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          {record.id === 'default' && <Tag color="default" style={{ fontSize: 10 }}>默认</Tag>}
        </div>
      ),
    },
    { title: '图标', dataIndex: 'icon', width: 64, render: (icon) => <span style={{ fontSize: 22 }}>{icon || '🏷️'}</span> },
    {
      title: '说明', dataIndex: 'id',
      render: (id) => <span style={{ color: 'var(--mub-text-secondary)', fontSize: 'var(--mub-font-size-sm)' }}>
        {id === 'default' ? '系统默认身份，不可删除' : '独立 Cookie / Storage / Cache'}
      </span>,
    },
    {
      title: '操作', width: 160, align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(record); form.setFieldsValue(record); setColor(record.color || '#4f6ef7'); setModalOpen(true);
          }}>编辑</Button>
          {record.id !== 'default' && (
            <Popconfirm title="确定删除此容器？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={<span className="mub-card-title"><CardIcon icon={<UserSwitchOutlined />} color="#4f6ef7" /><span>身份容器</span></span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]); setModalOpen(true); }}>新建容器</Button>}
      >
        <Table columns={columns} dataSource={containers} rowKey="id" loading={loading} pagination={DEFAULT_PAGINATION}
          locale={{ emptyText: <Empty description={<span>暂无自定义容器<br /><span className="mub-empty-hint">创建容器后，在浏览器标签页右键可切换身份</span></span>} /> }}
        />
      </Card>

      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 'var(--mub-space-sm)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--mub-radius-sm)', background: color, boxShadow: `0 2px 8px ${color}40` }} />
          {editing ? '编辑容器' : '新建容器'}
        </span>}
        open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }} okText="保存" cancelText="取消" width={440}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="容器名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：工作、个人、购物" size="large" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="输入 emoji，如 🏢 🏠 🛒" />
          </Form.Item>
          <Form.Item label="颜色"><ColorPicker value={color} onChange={setColor} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
