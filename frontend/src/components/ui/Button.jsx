export function Button({ variant = "ghost", className = "", ...props }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}
