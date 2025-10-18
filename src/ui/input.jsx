export function Input({ className = '', ...props }) {
  const cls = `wp-input ${className}`.trim();
  return <input className={cls} {...props} />;
}
