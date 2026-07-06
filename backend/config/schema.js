// Shared source of truth for the 12 value-chain domains.
// Each domain lists its fields (camelCase keys). The orchestrator builds an
// empty slice per domain from this, and the frontend mirrors the labels.

export const DOMAINS = [
  {
    key: 'techValueChain',
    label: 'Tech Value Chain',
    fields: [
      'rdAndInnovation',
      'productArchitecture',
      'dataMoat',
      'platformEcosystem',
      'buildVsBuy',
      'techTalent',
      'aiMlCapabilities',
    ],
  },
  {
    key: 'aiInnovationAndAdoption',
    label: 'AI Innovation & Adoption',
    fields: [
      'aiStrategy',
      'aiProducts',
      'aiInfrastructureAndCompute',
      'dataAssetsForAi',
      'aiTalentAndResearch',
      'aiPartnershipsAndInvestments',
      'aiMonetization',
      'internalAiAdoption',
      'aiRegulatoryAndEthicsStance',
      'aiCompetitivePosition',
    ],
  },
  {
    key: 'strategyAndMarket',
    label: 'Strategy & Market',
    fields: [
      'coreStrategy',
      'totalAddressableMarket',
      'marketShare',
      'growthRate',
      'geographicPresence',
      'networkEffects',
      'competitivePositioning',
    ],
  },
  {
    key: 'businessModel',
    label: 'Business Model',
    fields: [
      'revenueModel',
      'revenueStreams',
      'pricingStrategy',
      'unitEconomics',
      'scalability',
      'verticalIntegration',
    ],
  },
  {
    key: 'supplyAndInput',
    label: 'Supply / Input',
    fields: [
      'supplierConcentration',
      'rawMaterialDependencies',
      'procurementStrategy',
      'supplierNegotiatingPower',
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    fields: [
      'operationalModel',
      'manufacturingOrDelivery',
      'capacityUtilization',
      'qualityControl',
      'geographicFootprint',
    ],
  },
  {
    key: 'distribution',
    label: 'Distribution',
    fields: [
      'distributionChannels',
      'channelMix',
      'logisticsAndFulfillment',
      'partnerNetworks',
    ],
  },
  {
    key: 'salesAndMarketing',
    label: 'Sales & Marketing',
    fields: [
      'goToMarketStrategy',
      'salesModel',
      'marketingStrategy',
      'brandStrength',
      'customerAcquisitionCost',
    ],
  },
  {
    key: 'customerAndService',
    label: 'Customer / Service',
    fields: [
      'targetCustomerSegments',
      'customerLifetimeValue',
      'netPromoterScore',
      'churnRate',
      'customerSupportModel',
      'switchingCosts',
    ],
  },
  {
    key: 'financials',
    label: 'Financials',
    fields: [
      'revenue',
      'revenueGrowthRate',
      'grossMargin',
      'ebitda',
      'netIncome',
      'cashPosition',
      'debtLoad',
      'capitalExpenditure',
      'returnOnEquity',
      'valuationMultiple',
    ],
  },
  {
    key: 'competition',
    label: 'Competition',
    fields: [
      'primaryCompetitors',
      'competitiveAdvantages',
      'competitiveThreats',
      'barriersToEntry',
      'industryConsolidation',
    ],
  },
  {
    key: 'risksAndFuture',
    label: 'Risks & Future',
    fields: [
      'keyRisks',
      'regulatoryEnvironment',
      'macroTailwinds',
      'macroHeadwinds',
      'futureBets',
      'mAndAOpportunities',
    ],
  },
];

// Build an empty { field: "" } object for one domain — the slice each agent fills.
export function emptySlice(domain) {
  return Object.fromEntries(domain.fields.map((f) => [f, '']));
}
