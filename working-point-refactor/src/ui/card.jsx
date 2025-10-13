export function Card({ children }) {
  return <div className="border rounded shadow p-4 mb-4">{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={className}>{children}</div>;
}
