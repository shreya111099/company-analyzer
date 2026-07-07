import Est from './Est.jsx';

// The nine Osterwalder building blocks, laid out in the canonical canvas grid.
const BLOCKS = [
  { key: 'keyPartners', label: 'Key Partners', icon: '🤝', area: 'kp' },
  { key: 'keyActivities', label: 'Key Activities', icon: '⚙️', area: 'ka' },
  { key: 'keyResources', label: 'Key Resources', icon: '🏗️', area: 'kr' },
  { key: 'valuePropositions', label: 'Value Propositions', icon: '🎁', area: 'vp' },
  { key: 'customerRelationships', label: 'Customer Relationships', icon: '💬', area: 'cr' },
  { key: 'channels', label: 'Channels', icon: '🚚', area: 'ch' },
  { key: 'customerSegments', label: 'Customer Segments', icon: '👥', area: 'cs' },
  { key: 'costStructure', label: 'Cost Structure', icon: '💸', area: 'co' },
  { key: 'revenueStreams', label: 'Revenue Streams', icon: '💰', area: 'rev' },
];

export default function BusinessModelCanvas({ data }) {
  return (
    <div className="bmc">
      {BLOCKS.map((b) => {
        const items = Array.isArray(data[b.key]) ? data[b.key] : [];
        return (
          <div className={`bmc-block bmc-${b.area}`} key={b.key}>
            <div className="bmc-block-head">
              <span className="bmc-icon" aria-hidden="true">{b.icon}</span>
              {b.label}
            </div>
            <ul className="bmc-list">
              {items.length > 0 ? (
                items.map((item, i) => <li key={i}><Est text={item} /></li>)
              ) : (
                <li className="bmc-empty">—</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
