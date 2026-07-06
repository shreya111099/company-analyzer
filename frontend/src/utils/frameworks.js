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
  ansoff: {
    key: 'ansoff',
    label: 'Ansoff Matrix',
    modes: ['company'],
    layout: 'quadrant',
    note: 'Ansoff Matrix · growth strategy (products × markets)',
    blocks: [
      { key: 'marketPenetration', label: 'Market Penetration', icon: '🎯' },
      { key: 'marketDevelopment', label: 'Market Development', icon: '🌍' },
      { key: 'productDevelopment', label: 'Product Development', icon: '🧪' },
      { key: 'diversification', label: 'Diversification', icon: '🧭' },
    ],
  },
  bcg: {
    key: 'bcg',
    label: 'BCG Matrix',
    modes: ['company'],
    layout: 'quadrant',
    note: 'BCG Growth-Share Matrix · portfolio of business units',
    blocks: [
      { key: 'stars', label: 'Stars', icon: '⭐', tone: 'good' },
      { key: 'cashCows', label: 'Cash Cows', icon: '🐄' },
      { key: 'questionMarks', label: 'Question Marks', icon: '❓' },
      { key: 'dogs', label: 'Dogs', icon: '🐕', tone: 'bad' },
    ],
  },
  vrio: {
    key: 'vrio',
    label: 'VRIO',
    modes: ['company'],
    layout: 'grid',
    note: 'VRIO · resource-based competitive advantage',
    blocks: [
      { key: 'value', label: 'Value', icon: '💎' },
      { key: 'rarity', label: 'Rarity', icon: '🦄' },
      { key: 'imitability', label: 'Imitability', icon: '🛡️' },
      { key: 'organization', label: 'Organization', icon: '🏢' },
    ],
  },
  threeCs: {
    key: 'threeCs',
    label: "3C's",
    modes: ['company', 'sector'],
    layout: 'grid',
    note: "Ohmae's 3C's · Company · Customers · Competitors",
    blocks: [
      { key: 'company', label: 'Company', icon: '🏛️' },
      { key: 'customers', label: 'Customers', icon: '👥' },
      { key: 'competitors', label: 'Competitors', icon: '⚔️' },
    ],
  },
  sevenS: {
    key: 'sevenS',
    label: 'McKinsey 7S',
    modes: ['company'],
    layout: 'grid',
    note: 'McKinsey 7S · organizational alignment',
    blocks: [
      { key: 'strategy', label: 'Strategy', icon: '🧭' },
      { key: 'structure', label: 'Structure', icon: '🏗️' },
      { key: 'systems', label: 'Systems', icon: '⚙️' },
      { key: 'sharedValues', label: 'Shared Values', icon: '💠' },
      { key: 'skills', label: 'Skills', icon: '🎓' },
      { key: 'style', label: 'Style', icon: '🎨' },
      { key: 'staff', label: 'Staff', icon: '🧑‍💼' },
    ],
  },
  financials: {
    key: 'financials',
    label: 'Financial Snapshot',
    modes: ['company'],
    layout: 'financials', // special-cased: numeric mini-charts
    endpoint: '/api/financials',
    note: 'Financial snapshot · model-estimated figures',
  },
};

export const FRAMEWORK_ORDER = [
  'valuechain',
  'swot',
  'fiveforces',
  'pestel',
  'canvas',
  'financials',
  'ansoff',
  'bcg',
  'vrio',
  'threeCs',
  'sevenS',
];

export function frameworksForMode(mode) {
  return FRAMEWORK_ORDER.map((k) => FRAMEWORKS[k]).filter((f) => f.modes.includes(mode));
}
