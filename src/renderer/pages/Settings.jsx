import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Switch, Space, message, Divider } from 'antd';
import { SettingOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { safeCall } from '../utils/ipcHelper';
import CardIcon from '../components/CardIcon';

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await safeCall(() => window.electronAPI.getSettings(), {});
      form.setFieldsValue(settings);
    })();
  }, [form]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      await window.electronAPI.saveSettings(values);
      message.success('设置已保存');
    } catch { message.error('保存失败'); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    const defaults = await safeCall(() => window.electronAPI.resetSettings(), {});
    form.setFieldsValue(defaults);
    message.success('已重置为默认设置');
  };

  return (
    <Card
      title={<span className="mub-card-title"><CardIcon icon={<SettingOutlined />} color="#595959" /><span>设置</span></span>}
      extra={
        <Space>
          <Button icon={<UndoOutlined />} onClick={handleReset}>重置默认</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>保存</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
        <Form.Item name="homepage" label="主页">
          <Input placeholder="https://www.google.com" />
        </Form.Item>
        <Form.Item name="searchEngine" label="默认搜索引擎">
          <Select options={[
            { value: 'google', label: 'Google' },
            { value: 'baidu', label: '百度' },
            { value: 'bing', label: 'Bing' },
            { value: 'duckduckgo', label: 'DuckDuckGo' },
          ]} />
        </Form.Item>
        <Form.Item name="downloadPath" label="下载路径">
          <Input placeholder="留空使用系统默认" />
        </Form.Item>
        <Divider />
        <Form.Item name="darkMode" label="深色模式" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Card>
  );
}
