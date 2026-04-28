import React from 'react';

export default function CardIcon({ icon, color = '#4f6ef7' }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: `${color}15`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 16, marginRight: 8,
    }}>
      {icon}
    </div>
  );
}
