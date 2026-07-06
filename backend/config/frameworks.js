// Strategy "framework lenses" — each is a single structured model call that
// fills a set of named blocks. Value Chain (the multi-agent pipeline) is handled
// separately in the orchestrator; these are the compact single-call frameworks.

function subject(mode, query, country) {
  const geo = mode === 'sector' && country && country !== 'Global' ? ` in ${country}` : '';
  return mode === 'sector' ? `the "${query}" sector/industry${geo}` : `the company "${query}"`;
}

function jsonShape(blocks) {
  return JSON.stringify(Object.fromEntries(blocks.map((b) => [b.key, []])), null, 2);
}

export const FRAMEWORKS = {
  swot: {
    label: 'SWOT Analysis',
    modes: ['company', 'sector'],
    blocks: [
      { key: 'strengths', label: 'Strengths' },
      { key: 'weaknesses', label: 'Weaknesses' },
      { key: 'opportunities', label: 'Opportunities' },
      { key: 'threats', label: 'Threats' },
    ],
    system:
      'You are a strategy expert producing a rigorous SWOT analysis. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Produce a SWOT analysis for ${subject(mode, query, country)}. Strengths and Weaknesses are INTERNAL; Opportunities and Threats are EXTERNAL. Give 3-5 concise, specific bullet points per block (short phrases, not sentences). Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  fiveforces: {
    label: "Porter's Five Forces",
    modes: ['company', 'sector'],
    blocks: [
      { key: 'competitiveRivalry', label: 'Competitive Rivalry' },
      { key: 'supplierPower', label: 'Supplier Power' },
      { key: 'buyerPower', label: 'Buyer Power' },
      { key: 'threatOfSubstitutes', label: 'Threat of Substitutes' },
      { key: 'threatOfNewEntrants', label: 'Threat of New Entrants' },
    ],
    system:
      "You are a strategy expert applying Porter's Five Forces. Respond with ONLY a valid JSON object — no prose, no markdown fences.",
    buildPrompt(mode, query, country) {
      return `Apply Porter's Five Forces to ${subject(mode, query, country)}. For EACH force, make the FIRST bullet an intensity verdict — "High / Medium / Low" with a short reason — then 2-3 supporting points. Concise phrases. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  pestel: {
    label: 'PESTEL Analysis',
    modes: ['sector', 'company'],
    blocks: [
      { key: 'political', label: 'Political' },
      { key: 'economic', label: 'Economic' },
      { key: 'social', label: 'Social' },
      { key: 'technological', label: 'Technological' },
      { key: 'environmental', label: 'Environmental' },
      { key: 'legal', label: 'Legal' },
    ],
    system:
      'You are a strategy expert producing a PESTEL macro-environment analysis. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Produce a PESTEL macro-environment analysis for ${subject(mode, query, country)}. Give 2-4 concise, specific bullet points per factor (Political, Economic, Social, Technological, Environmental, Legal). Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  canvas: {
    label: 'Business Model Canvas',
    modes: ['company'],
    blocks: [
      { key: 'keyPartners', label: 'Key Partners' },
      { key: 'keyActivities', label: 'Key Activities' },
      { key: 'keyResources', label: 'Key Resources' },
      { key: 'valuePropositions', label: 'Value Propositions' },
      { key: 'customerRelationships', label: 'Customer Relationships' },
      { key: 'channels', label: 'Channels' },
      { key: 'customerSegments', label: 'Customer Segments' },
      { key: 'costStructure', label: 'Cost Structure' },
      { key: 'revenueStreams', label: 'Revenue Streams' },
    ],
    system:
      'You are a business strategy expert building a Business Model Canvas (Osterwalder & Pigneur). Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Build a Business Model Canvas for the company "${query}". For EACH of the nine blocks, give 2-4 concise bullet phrases grounded in what is known about ${query}. Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  ansoff: {
    label: 'Ansoff Matrix',
    modes: ['company'],
    blocks: [
      { key: 'marketPenetration', label: 'Market Penetration' },
      { key: 'marketDevelopment', label: 'Market Development' },
      { key: 'productDevelopment', label: 'Product Development' },
      { key: 'diversification', label: 'Diversification' },
    ],
    system:
      'You are a growth-strategy expert applying the Ansoff Matrix. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Apply the Ansoff growth matrix to ${subject(mode, query, country)}. Market Penetration = existing products in existing markets; Market Development = existing products in new markets; Product Development = new products in existing markets; Diversification = new products in new markets. Give 2-4 concrete, specific growth moves per quadrant. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  bcg: {
    label: 'BCG Matrix',
    modes: ['company'],
    blocks: [
      { key: 'stars', label: 'Stars' },
      { key: 'cashCows', label: 'Cash Cows' },
      { key: 'questionMarks', label: 'Question Marks' },
      { key: 'dogs', label: 'Dogs' },
    ],
    system:
      'You are a portfolio-strategy expert applying the BCG Growth-Share Matrix. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Apply the BCG Growth-Share Matrix to the product lines / business units of the company "${query}". Stars = high growth, high share; Cash Cows = low growth, high share; Question Marks = high growth, low share; Dogs = low growth, low share. Classify 2-4 actual, named products or business units per quadrant. Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  vrio: {
    label: 'VRIO Analysis',
    modes: ['company'],
    blocks: [
      { key: 'value', label: 'Value' },
      { key: 'rarity', label: 'Rarity' },
      { key: 'imitability', label: 'Imitability' },
      { key: 'organization', label: 'Organization' },
    ],
    system:
      'You are a strategy expert applying the VRIO framework to a firm’s resources and capabilities. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Apply the VRIO framework to the company "${query}". Value = does the resource exploit an opportunity/neutralize a threat; Rarity = is it rare among competitors; Imitability = is it costly to imitate; Organization = is the firm organized to capture the value. For each dimension, give 2-4 bullets naming the specific resources/capabilities and the verdict. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  threeCs: {
    label: "3C's Analysis",
    modes: ['company', 'sector'],
    blocks: [
      { key: 'company', label: 'Company' },
      { key: 'customers', label: 'Customers' },
      { key: 'competitors', label: 'Competitors' },
    ],
    system:
      "You are a strategy expert applying Ohmae's 3C's model. Respond with ONLY a valid JSON object — no prose, no markdown fences.",
    buildPrompt(mode, query, country) {
      return `Apply the 3C's model to ${subject(mode, query, country)}. Company = strengths, capabilities, positioning; Customers = segments, needs, behavior; Competitors = key rivals and their moves. Give 3-5 concise, specific bullets per C. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },

  sevenS: {
    label: 'McKinsey 7S',
    modes: ['company'],
    blocks: [
      { key: 'strategy', label: 'Strategy' },
      { key: 'structure', label: 'Structure' },
      { key: 'systems', label: 'Systems' },
      { key: 'sharedValues', label: 'Shared Values' },
      { key: 'skills', label: 'Skills' },
      { key: 'style', label: 'Style' },
      { key: 'staff', label: 'Staff' },
    ],
    system:
      'You are an organizational-strategy expert applying the McKinsey 7S framework. Respond with ONLY a valid JSON object — no prose, no markdown fences.',
    buildPrompt(mode, query, country) {
      return `Apply the McKinsey 7S framework to the company "${query}" — the three "hard" elements (Strategy, Structure, Systems) and four "soft" elements (Shared Values, Skills, Style, Staff). Give 2-3 concise, specific bullets per element. Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },
};
