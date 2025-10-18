export function Button({ children, className = '', variant = 'primary', ...props }) {
  const cls = `wp-btn ${variant === 'secondary' ? 'secondary' : ''} ${className}`.trim();
  return <button className={cls} {...props}>{children}</button>;
}
