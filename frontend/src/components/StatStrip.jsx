// A compact row of headline numbers above the value-chain output — the figures
// you can recall under interview pressure (stages analyzed, sources cited, etc.).

export default function StatStrip({ stats }) {
  const shown = stats.filter((s) => s.value !== null && s.value !== undefined);
  if (shown.length === 0) return null;
  return (
    <div className="stat-strip">
      {shown.map((s) => (
        <div className="stat-tile" key={s.label}>
          <div className="stat-value">{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
