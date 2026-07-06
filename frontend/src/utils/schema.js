export const SECTIONS = [
  {
    key: 'techValueChain',
    label: 'Tech Value Chain',
    fields: [
      { key: 'rdAndInnovation',     label: 'R&D & Innovation' },
      { key: 'productArchitecture', label: 'Product Architecture' },
      { key: 'dataMoat',            label: 'Data Moat' },
      { key: 'platformEcosystem',   label: 'Platform & Ecosystem' },
      { key: 'buildVsBuy',          label: 'Build vs. Buy Strategy' },
      { key: 'techTalent',          label: 'Tech Talent' },
      { key: 'aiMlCapabilities',    label: 'AI / ML Capabilities' },
    ],
  },
  {
    key: 'aiInnovationAndAdoption',
    label: 'AI Innovation & Adoption',
    fields: [
      { key: 'aiStrategy',                    label: 'AI Strategy' },
      { key: 'aiProducts',                    label: 'AI-Powered Products' },
      { key: 'aiInfrastructureAndCompute',    label: 'AI Infrastructure & Compute' },
      { key: 'dataAssetsForAi',               label: 'Data Assets for AI' },
      { key: 'aiTalentAndResearch',           label: 'AI Talent & Research' },
      { key: 'aiPartnershipsAndInvestments',  label: 'AI Partnerships & Investments' },
      { key: 'aiMonetization',                label: 'AI Monetization' },
      { key: 'internalAiAdoption',            label: 'Internal AI Adoption' },
      { key: 'aiRegulatoryAndEthicsStance',   label: 'AI Regulatory & Ethics Stance' },
      { key: 'aiCompetitivePosition',         label: 'AI Competitive Position' },
    ],
  },
  {
    key: 'strategyAndMarket',
    label: 'Strategy & Market',
    fields: [
      { key: 'coreStrategy',           label: 'Core Strategy' },
      { key: 'totalAddressableMarket', label: 'Total Addressable Market' },
      { key: 'marketShare',            label: 'Market Share' },
      { key: 'growthRate',             label: 'Growth Rate' },
      { key: 'geographicPresence',     label: 'Geographic Presence' },
      { key: 'networkEffects',         label: 'Network Effects' },
      { key: 'competitivePositioning', label: 'Competitive Positioning' },
    ],
  },
  {
    key: 'businessModel',
    label: 'Business Model',
    fields: [
      { key: 'revenueModel',       label: 'Revenue Model' },
      { key: 'revenueStreams',      label: 'Revenue Streams' },
      { key: 'pricingStrategy',    label: 'Pricing Strategy' },
      { key: 'unitEconomics',      label: 'Unit Economics' },
      { key: 'scalability',        label: 'Scalability' },
      { key: 'verticalIntegration',label: 'Vertical Integration' },
    ],
  },
  {
    key: 'supplyAndInput',
    label: 'Supply / Input',
    fields: [
      { key: 'supplierConcentration',     label: 'Supplier Concentration' },
      { key: 'rawMaterialDependencies',   label: 'Raw Material Dependencies' },
      { key: 'procurementStrategy',       label: 'Procurement Strategy' },
      { key: 'supplierNegotiatingPower',  label: 'Supplier Negotiating Power' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    fields: [
      { key: 'operationalModel',       label: 'Operational Model' },
      { key: 'manufacturingOrDelivery',label: 'Manufacturing / Delivery' },
      { key: 'capacityUtilization',    label: 'Capacity Utilization' },
      { key: 'qualityControl',         label: 'Quality Control' },
      { key: 'geographicFootprint',    label: 'Geographic Footprint' },
    ],
  },
  {
    key: 'distribution',
    label: 'Distribution',
    fields: [
      { key: 'distributionChannels',   label: 'Distribution Channels' },
      { key: 'channelMix',             label: 'Channel Mix' },
      { key: 'logisticsAndFulfillment',label: 'Logistics & Fulfillment' },
      { key: 'partnerNetworks',        label: 'Partner Networks' },
    ],
  },
  {
    key: 'salesAndMarketing',
    label: 'Sales & Marketing',
    fields: [
      { key: 'goToMarketStrategy',    label: 'Go-to-Market Strategy' },
      { key: 'salesModel',            label: 'Sales Model' },
      { key: 'marketingStrategy',     label: 'Marketing Strategy' },
      { key: 'brandStrength',         label: 'Brand Strength' },
      { key: 'customerAcquisitionCost', label: 'Customer Acquisition Cost' },
    ],
  },
  {
    key: 'customerAndService',
    label: 'Customer / Service',
    fields: [
      { key: 'targetCustomerSegments', label: 'Target Customer Segments' },
      { key: 'customerLifetimeValue',  label: 'Customer Lifetime Value' },
      { key: 'netPromoterScore',       label: 'Net Promoter Score' },
      { key: 'churnRate',              label: 'Churn Rate' },
      { key: 'customerSupportModel',   label: 'Customer Support Model' },
      { key: 'switchingCosts',         label: 'Switching Costs' },
    ],
  },
  {
    key: 'financials',
    label: 'Financials',
    fields: [
      { key: 'revenue',            label: 'Revenue' },
      { key: 'revenueGrowthRate',  label: 'Revenue Growth Rate' },
      { key: 'grossMargin',        label: 'Gross Margin' },
      { key: 'ebitda',             label: 'EBITDA' },
      { key: 'netIncome',          label: 'Net Income' },
      { key: 'cashPosition',       label: 'Cash Position' },
      { key: 'debtLoad',           label: 'Debt Load' },
      { key: 'capitalExpenditure', label: 'Capital Expenditure' },
      { key: 'returnOnEquity',     label: 'Return on Equity' },
      { key: 'valuationMultiple',  label: 'Valuation Multiple' },
    ],
  },
  {
    key: 'competition',
    label: 'Competition',
    fields: [
      { key: 'primaryCompetitors',    label: 'Primary Competitors' },
      { key: 'competitiveAdvantages', label: 'Competitive Advantages' },
      { key: 'competitiveThreats',    label: 'Competitive Threats' },
      { key: 'barriersToEntry',       label: 'Barriers to Entry' },
      { key: 'industryConsolidation', label: 'Industry Consolidation' },
    ],
  },
  {
    key: 'risksAndFuture',
    label: 'Risks & Future',
    fields: [
      { key: 'keyRisks',              label: 'Key Risks' },
      { key: 'regulatoryEnvironment', label: 'Regulatory Environment' },
      { key: 'macroTailwinds',        label: 'Macro Tailwinds' },
      { key: 'macroHeadwinds',        label: 'Macro Headwinds' },
      { key: 'futureBets',            label: 'Future Bets' },
      { key: 'mAndAOpportunities',    label: 'M&A Opportunities' },
    ],
  },
];

// Section-label overrides when analyzing a whole sector rather than a company.
// Falls back to the company-mode label when a key isn't overridden.
const SECTOR_SECTION_LABELS = {
  strategyAndMarket: 'Market Structure & Strategy',
  businessModel: 'Industry Business Models',
  competition: 'Competitive Landscape',
  financials: 'Sector Economics',
  customerAndService: 'Demand & Customers',
};

export function sectionLabel(section, mode) {
  return mode === 'sector'
    ? SECTOR_SECTION_LABELS[section.key] || section.label
    : section.label;
}

// Shape of the synthesis agent's output, used by SynthesisCard and the export.
export const SYNTHESIS_FIELDS = [
  { key: 'keyStrengths', label: 'Key Strengths' },
  { key: 'keyWeaknesses', label: 'Key Weaknesses' },
  { key: 'strategicRecommendations', label: 'Strategic Recommendations' },
  { key: 'keyQuestionsForDiligence', label: 'Key Questions for Diligence' },
];

export function formatAsInterviewNotes(mode, query, analysis, synthesis) {
  const heading = mode === 'sector' ? 'SECTOR ANALYSIS' : 'COMPANY ANALYSIS';
  const lines = [`${heading}: ${query.toUpperCase()}`, '='.repeat(60), ''];

  if (synthesis) {
    lines.push('## Strategic Synthesis');
    lines.push('-'.repeat(40));
    if (synthesis.executiveSummary) {
      lines.push('Executive Summary:');
      lines.push(`  ${synthesis.executiveSummary}`);
      lines.push('');
    }
    for (const field of SYNTHESIS_FIELDS) {
      const items = synthesis[field.key];
      if (Array.isArray(items) && items.length) {
        lines.push(`${field.label}:`);
        for (const item of items) if (item) lines.push(`  • ${item}`);
        lines.push('');
      }
    }
    lines.push('');
  }

  for (const section of SECTIONS) {
    const data = analysis[section.key];
    if (!data) continue;

    lines.push(`## ${sectionLabel(section, mode)}`);
    lines.push('-'.repeat(40));

    for (const field of section.fields) {
      const value = data[field.key];
      if (value) {
        lines.push(`${field.label}:`);
        lines.push(`  ${value}`);
        lines.push('');
      }
    }

    lines.push('');
  }

  lines.push(`Generated ${new Date().toLocaleDateString()} via Company Analyzer`);

  return lines.join('\n');
}
