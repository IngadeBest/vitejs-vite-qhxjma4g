export function Card({ children, variant, className = '' }) {
  const variantClass = variant === 'info' ? 'info' : '';
  const cls = `wp-card ${variantClass} ${className}`.trim();
  return <div className={cls}>{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={className}>{children}</div>;
}
