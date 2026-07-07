// Persistent epistemic-humility line shown with every result.
export default function Disclaimer() {
  return (
    <p className="disclaimer">
      <span aria-hidden="true">⚠︎</span>
      LLM-generated estimates — directional, not audited. Verify figures before decisions.
    </p>
  );
}
