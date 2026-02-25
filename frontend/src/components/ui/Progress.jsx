export function Progress({ value }) {
  return (
    <div className="progress">
      <div className="progressFill" style={{ width: `${value}%` }} />
    </div>
  );
}
