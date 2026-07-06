import BusinessModelCanvas from './BusinessModelCanvas.jsx';
import { FRAMEWORKS } from '../utils/frameworks.js';

function Block({ block, items, className = '' }) {
  return (
    <div className={`fw-block ${className}`}>
      <div className="fw-block-head">
        {block.icon && <span className="fw-icon" aria-hidden="true">{block.icon}</span>}
        {block.label}
      </div>
      <ul className="fw-list">
        {items && items.length > 0 ? (
          items.map((it, i) => <li key={i}>{it}</li>)
        ) : (
          <li className="fw-empty">—</li>
        )}
      </ul>
    </div>
  );
}

export default function FrameworkView({ framework, data }) {
  const spec = FRAMEWORKS[framework];
  if (!spec || !data) return null;

  // Business Model Canvas has its own dedicated layout.
  if (spec.layout === 'canvas') return <BusinessModelCanvas data={data} />;

  // Porter's Five Forces — center rivalry surrounded by the four forces.
  if (spec.layout === 'forces') {
    return (
      <div className="fw fw--forces">
        {spec.blocks.map((b) => (
          <Block key={b.key} block={b} items={data[b.key]} className={`fw-force-${b.area} ${b.area === 'riv' ? 'fw-center' : ''}`} />
        ))}
      </div>
    );
  }

  // SWOT (2×2 quadrant) and PESTEL (grid) share the block-grid renderer.
  return (
    <div className={`fw fw--${spec.layout}`}>
      {spec.blocks.map((b) => (
        <Block key={b.key} block={b} items={data[b.key]} className={b.tone ? `fw-tone-${b.tone}` : ''} />
      ))}
    </div>
  );
}
