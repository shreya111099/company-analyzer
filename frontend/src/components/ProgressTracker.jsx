const ICON = {
  queued: '○',
  running: '◐',
  done: '●',
  error: '×',
};

function providerName(provider) {
  return { gemini: 'Gemini', groq: 'Groq', huggingface: 'HF' }[provider] || provider;
}

export default function ProgressTracker({ steps }) {
  const done = steps.filter((s) => s.status === 'done').length;
  const errored = steps.filter((s) => s.status === 'error').length;
  const total = steps.length;

  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-head">
        <span className="progress-title">Running agents</span>
        <span className="progress-count">
          {done}/{total} done{errored ? ` · ${errored} failed` : ''}
        </span>
      </div>
      <ul className="progress-list">
        {steps.map((s) => (
          <li key={s.key} className={`progress-item progress-item--${s.status}`}>
            <span className="progress-icon" aria-hidden="true">
              {ICON[s.status] || '○'}
            </span>
            <span className="progress-label">{s.label}</span>
            {s.provider && s.status !== 'queued' && (
              <span className="progress-provider">
                {providerName(s.fellBack ? 'gemini' : s.provider)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
