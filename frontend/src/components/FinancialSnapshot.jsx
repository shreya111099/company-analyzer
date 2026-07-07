import Est from './Est.jsx';

// Financial mini-charts: headline metric tiles, a revenue-trend bar chart, and
// margin bars. Pure CSS/flex charts — no chart library.

function fmt(value, unit) {
  if (value === null || value === undefined) return '—';
  const v = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  const u = String(unit || '').toLowerCase();
  if (u.includes('%')) return `${v}%`;
  if (u === 'x' || u.includes('x')) return `${v}×`;
  if (u.includes('t')) return `$${v}T`;
  if (u.includes('b')) return `$${v}B`;
  if (u.includes('m')) return `$${v}M`;
  return `${v}${unit ? ' ' + unit : ''}`;
}

export default function FinancialSnapshot({ data }) {
  if (!data) return null;
  const { metrics = [], revenueTrend = [], margins = [] } = data;
  const maxRev = Math.max(...revenueTrend.map((d) => d.value), 1);

  return (
    <div className="fin">
      {metrics.length > 0 && (
        <div className="fin-metrics">
          {metrics.map((m) => (
            <div className="fin-tile" key={m.label}>
              <div className="fin-value">{fmt(m.value, m.unit)}</div>
              <div className="fin-label">
                {m.label}
                {m.note ? <span className="fin-note"> <Est text={m.note} /></span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fin-charts">
        {revenueTrend.length > 0 && (
          <div className="fin-card">
            <div className="fin-card-title">Revenue trend <span className="fin-unit">($B)</span></div>
            <div className="fin-bars">
              {revenueTrend.map((d) => (
                <div className="fin-bar-col" key={d.period}>
                  <div className="fin-bar-val">{d.value}</div>
                  <div className="fin-bar" style={{ height: `${Math.max((d.value / maxRev) * 100, 4)}%` }} />
                  <div className="fin-bar-label">{d.period}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {margins.length > 0 && (
          <div className="fin-card">
            <div className="fin-card-title">Margins <span className="fin-unit">(%)</span></div>
            <div className="fin-margins">
              {margins.map((d) => (
                <div className="fin-margin-row" key={d.label}>
                  <span className="fin-margin-label">{d.label}</span>
                  <div className="fin-margin-track">
                    <div
                      className="fin-margin-fill"
                      style={{ width: `${Math.min(Math.max(d.value, 0), 100)}%` }}
                    />
                  </div>
                  <span className="fin-margin-val">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="bmc-note">Figures are model estimates — verify against filings before use.</p>
    </div>
  );
}
