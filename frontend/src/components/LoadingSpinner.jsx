export default function LoadingSpinner() {
  return (
    <div className="spinner-wrapper" role="status" aria-label="Loading analysis">
      <div className="spinner" />
      <p className="spinner-text">Running full value chain analysis…</p>
    </div>
  );
}
