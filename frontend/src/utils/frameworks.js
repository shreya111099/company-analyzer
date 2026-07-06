// UI specs for the framework lenses. 'valuechain' is the multi-agent pipeline
// (handled specially); the rest are single-call frameworks with their own layout.

export const FRAMEWORKS = {
  valuechain: {
    key: 'valuechain',
    label: 'Value Chain',
    modes: ['company', 'sector'],
    layout: 'pipeline',
  },
  swot: {
    key: 'swot',
    label: 'SWOT',
    modes: ['company', 'sector'],
    layout: 'quadrant',
    note: 'SWOT · internal strengths/weaknesses vs. external opportunities/threats',
    blocks: [
      { key: 'strengths', label: 'Strengths', icon: '💪', tone: 'good' },
      { key: 'weaknesses', label: 'Weaknesses', icon: '⚠️', tone: 'bad' },
      { key: 'opportunities', label: 'Opportunities', icon: '🚀', tone: 'good' },
      { key: 'threats', label: 'Threats', icon: '🌩️', tone: 'bad' },
    ],
  },
  fiveforces: {
    key: 'fiveforces',
    label: "Porter's Five Forces",
    modes: ['company', 'sector'],
    layout: 'forces',
    note: "Porter's Five Forces · industry structure & attractiveness",
    blocks: [
      { key: 'threatOfNewEntrants', label: 'Threat of New Entrants', icon: '🚪', area: 'new' },
      { key: 'supplierPower', label: 'Supplier Power', icon: '🏭', area: 'sup' },
      { key: 'competitiveRivalry', label: 'Competitive Rivalry', icon: '⚔️', area: 'riv' },
      { key: 'buyerPower', label: 'Buyer Power', icon: '🛒', area: 'buy' },
      { key: 'threatOfSubstitutes', label: 'Threat of Substitutes', icon: '🔄', area: 'sub' },
    ],
  },
  pestel: {
    key: 'pestel',
    label: 'PESTEL',
    modes: ['sector', 'company'],
    layout: 'grid',
    note: 'PESTEL · macro-environment factors',
    blocks: [
      { key: 'political', label: 'Political', icon: '🏛️' },
      { key: 'economic', label: 'Economic', icon: '📈' },
      { key: 'social', label: 'Social', icon: '👥' },
      { key: 'technological', label: 'Technological', icon: '💡' },
      { key: 'environmental', label: 'Environmental', icon: '🌱' },
      { key: 'legal', label: 'Legal', icon: '⚖️' },
    ],
  },
  canvas: {
    key: 'canvas',
    label: 'Business Model Canvas',
    modes: ['company'],
    layout: 'canvas',
    note: 'Business Model Canvas · Osterwalder & Pigneur framework',
  },
};

export const FRAMEWORK_ORDER = ['valuechain', 'swot', 'fiveforces', 'pestel', 'canvas'];

export function frameworksForMode(mode) {
  return FRAMEWORK_ORDER.map((k) => FRAMEWORKS[k]).filter((f) => f.modes.includes(mode));
}
