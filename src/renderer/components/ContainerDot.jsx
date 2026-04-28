import React from 'react';

export default function ContainerDot({ color, size = 10, title, style }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || '#8c8c8c',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
