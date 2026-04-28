import React from 'react';
import {
  UserSwitchOutlined, GlobalOutlined, FolderOutlined,
  CodeOutlined, SettingOutlined, StarOutlined, HistoryOutlined,
} from '@ant-design/icons';

export const menuGroups = [
  {
    key: 'nav',
    items: [
      { key: '/browser', icon: <GlobalOutlined />, label: '浏览器' },
      { key: '/containers', icon: <UserSwitchOutlined />, label: '身份容器' },
    ],
  },
  {
    key: 'data', label: '数据',
    items: [
      { key: '/bookmarks', icon: <StarOutlined />, label: '书签' },
      { key: '/history', icon: <HistoryOutlined />, label: '历史' },
    ],
  },
  {
    key: 'tools', label: '工具',
    items: [
      { key: '/files', icon: <FolderOutlined />, label: '文件管理' },
      { key: '/scripts', icon: <CodeOutlined />, label: '脚本管理' },
    ],
  },
  {
    key: 'system',
    items: [
      { key: '/settings', icon: <SettingOutlined />, label: '设置' },
    ],
  },
];

export function buildMenuItems() {
  const items = [];
  menuGroups.forEach((group, gi) => {
    if (gi > 0) items.push({ type: 'divider', key: `div-${gi}` });
    if (group.label) {
      items.push({
        type: 'group',
        label: (
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)', paddingLeft: 4,
          }}>{group.label}</span>
        ),
        key: `grp-${group.key}`,
        children: group.items,
      });
    } else {
      items.push(...group.items);
    }
  });
  return items;
}

export const menuItems = buildMenuItems();

export function findMenuLabel(pathname) {
  return menuItems
    .filter((item) => !item.type)
    .flatMap((item) => item.children || [item])
    .find((item) => item.key === pathname)?.label || '';
}
