// Strategy "framework lenses" — each is a single structured model call that
// fills a set of named blocks. Value Chain (the multi-agent pipeline) is handled
// separately in the orchestrator; these are the compact single-call frameworks.

function subject(mode, query) {
  return mode === 'sector' ? `the "${query}" sector/industry` : `the company "${query}"`;
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
    buildPrompt(mode, query) {
      return `Produce a SWOT analysis for ${subject(mode, query)}. Strengths and Weaknesses are INTERNAL; Opportunities and Threats are EXTERNAL. Give 3-5 concise, specific bullet points per block (short phrases, not sentences). Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
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
    buildPrompt(mode, query) {
      return `Apply Porter's Five Forces to ${subject(mode, query)}. For EACH force, make the FIRST bullet an intensity verdict — "High / Medium / Low" with a short reason — then 2-3 supporting points. Concise phrases. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
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
    buildPrompt(mode, query) {
      return `Produce a PESTEL macro-environment analysis for ${subject(mode, query)}. Give 2-4 concise, specific bullet points per factor (Political, Economic, Social, Technological, Environmental, Legal). Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
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
    buildPrompt(mode, query) {
      return `Build a Business Model Canvas for the company "${query}". For EACH of the nine blocks, give 2-4 concise bullet phrases grounded in what is known about ${query}. Label "(estimated)" only if uncertain. Return ONLY this JSON object (each value an array of strings):\n\n${jsonShape(this.blocks)}`;
    },
  },
};
