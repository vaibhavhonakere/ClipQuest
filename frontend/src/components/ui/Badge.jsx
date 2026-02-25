export function Badge({ className = "", children }) {
  return <span className={`badge ${className}`}>{children}</span>;
}
