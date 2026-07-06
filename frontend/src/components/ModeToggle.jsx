const MODES = [
  { key: 'company', label: 'Company', hint: 'Analyze one company' },
  { key: 'sector', label: 'Sector', hint: 'Analyze a whole industry' },
];

export default function ModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="Analysis mode">
      {MODES.map((m) => (
        <button
          key={m.key}
          role="tab"
          type="button"
          aria-selected={mode === m.key}
          title={m.hint}
          className={`mode-option ${mode === m.key ? 'mode-option--active' : ''}`}
          onClick={() => onChange(m.key)}
          disabled={disabled}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
