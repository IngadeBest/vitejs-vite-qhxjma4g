import React from 'react';

export default function Container({ children, className = '', style = {}, maxWidth }) {
  const cls = `wp-container ${className}`.trim();
  const applied = { maxWidth: maxWidth || undefined, ...style };
  return (
    <div className={cls} style={applied}>
      {children}
    </div>
  );
}
