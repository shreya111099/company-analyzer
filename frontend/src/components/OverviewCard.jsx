import Est from './Est.jsx';

// Company mode → a brief summary paragraph.
// Sector mode  → Current Trends + Recent News lists.
export default function OverviewCard({ mode, overview }) {
  if (!overview) return null;

  if (mode === 'sector') {
    const trends = Array.isArray(overview.trends) ? overview.trends : [];
    const recentNews = Array.isArray(overview.recentNews) ? overview.recentNews : [];
    if (trends.length === 0 && recentNews.length === 0) return null;
    return (
      <section className="overview" aria-label="Trends and recent news">
        <h3 className="overview-title">📈 Trends &amp; Recent News</h3>
        <div className="overview-grid">
          {trends.length > 0 && (
            <div className="overview-block">
              <h4 className="overview-block-title">Current Trends</h4>
              <ul className="overview-list">
                {trends.map((t, i) => <li key={i}><Est text={t} /></li>)}
              </ul>
            </div>
          )}
          {recentNews.length > 0 && (
            <div className="overview-block">
              <h4 className="overview-block-title overview-block-title--news">Recent News</h4>
              <ul className="overview-list">
                {recentNews.map((t, i) => <li key={i}><Est text={t} /></li>)}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!overview.summary) return null;
  return (
    <section className="overview" aria-label="Company summary">
      <h3 className="overview-title">🏢 Company Summary</h3>
      <p className="overview-summary"><Est text={overview.summary} /></p>
    </section>
  );
}
