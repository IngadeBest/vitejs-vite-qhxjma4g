export function Card({ children, variant }) {
  const base = "border rounded shadow p-4 mb-4";
  const variantClass = variant === "info" ? "bg-blue-50 border-blue-100" : "bg-white";
  return <div className={`${base} ${variantClass}`}>{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={className}>{children}</div>;
}
