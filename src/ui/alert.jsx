import React from 'react';

export function Alert({ children, type = 'info', className = '', ...props }) {
  const base = 'wp-alert';
  const t = type === 'success' ? 'wp-alert-success' : type === 'error' ? 'wp-alert-error' : 'wp-alert-info';
  return (
    <div className={`${base} ${t} ${className}`} role={type === 'error' ? 'alert' : 'status'} {...props}>
      {children}
    </div>
  );
}

export default Alert;
