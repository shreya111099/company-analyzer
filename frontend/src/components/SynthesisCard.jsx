import { SYNTHESIS_FIELDS } from '../utils/schema.js';
import Est from './Est.jsx';

export default function SynthesisCard({ synthesis }) {
  if (!synthesis) return null;

  const lists = SYNTHESIS_FIELDS.filter(
    (f) => Array.isArray(synthesis[f.key]) && synthesis[f.key].length > 0
  );

  return (
    <section className="synthesis" aria-label="Strategic synthesis">
      <h3 className="synthesis-title">Strategic Synthesis</h3>

      {synthesis.executiveSummary && (
        <p className="synthesis-summary"><Est text={synthesis.executiveSummary} /></p>
      )}

      <div className="synthesis-grid">
        {lists.map((f) => (
          <div className={`synthesis-block synthesis-block--${f.key}`} key={f.key}>
            <h4 className="synthesis-block-title">{f.label}</h4>
            <ul className="synthesis-block-list">
              {synthesis[f.key].map((item, i) => (
                <li key={i}><Est text={item} /></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
