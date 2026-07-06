// The multi-agent pipeline made visible: a strip of chips with live per-agent
// state (queued / running / done / error). Doubles as the progress indicator and
// stays visible after the run so the built-by-agents story is on screen.

const ICON = { queued: '○', running: '◐', done: '●', error: '✕' };

export default function PipelineStrip({ steps, title = 'Agent pipeline', compact = false }) {
  if (!steps || steps.length === 0) return null;
  const done = steps.filter((s) => s.status === 'done').length;
  const failed = steps.filter((s) => s.status === 'error').length;

  return (
    <section className={`pipeline ${compact ? 'pipeline--compact' : ''}`} aria-label="Agent pipeline">
      <div className="pipeline-head">
        <span className="pipeline-title">{title}</span>
        <span className="pipeline-count">
          {done}/{steps.length} done{failed ? ` · ${failed} failed` : ''}
        </span>
      </div>
      <div className="pipeline-track">
        {steps.map((s, i) => (
          <span className="pipeline-node" key={s.key}>
            <span className={`chip chip--${s.status}`} title={s.provider || ''}>
              <span className="chip-dot" aria-hidden="true">
                {ICON[s.status] || '○'}
              </span>
              <span className="chip-label">{s.label}</span>
            </span>
            {i < steps.length - 1 && <span className="pipeline-arrow" aria-hidden="true">›</span>}
          </span>
        ))}
      </div>
    </section>
  );
}
