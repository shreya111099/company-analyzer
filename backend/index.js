import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are an MBA case-interview coach with deep expertise in company analysis. When given a company name, produce a thorough analysis across the full Tech + Business Value Chain framework. Rules:
1. Every field must be 1-3 sentences, specific and grounded in what is actually known about this company — no generic MBA boilerplate.
2. If a specific figure or fact is uncertain or estimated, include the label "(estimated)" rather than stating it as confirmed fact.
3. Respond with ONLY a valid JSON object. No markdown code fences, no preamble, no trailing commentary — just the raw JSON.`;

const SCHEMA_TEMPLATE = {
  techValueChain: {
    rdAndInnovation: "",
    productArchitecture: "",
    dataMoat: "",
    platformEcosystem: "",
    buildVsBuy: "",
    techTalent: "",
    aiMlCapabilities: ""
  },
  aiInnovationAndAdoption: {
    aiStrategy: "",
    aiProducts: "",
    aiInfrastructureAndCompute: "",
    dataAssetsForAi: "",
    aiTalentAndResearch: "",
    aiPartnershipsAndInvestments: "",
    aiMonetization: "",
    internalAiAdoption: "",
    aiRegulatoryAndEthicsStance: "",
    aiCompetitivePosition: ""
  },
  strategyAndMarket: {
    coreStrategy: "",
    totalAddressableMarket: "",
    marketShare: "",
    growthRate: "",
    geographicPresence: "",
    networkEffects: "",
    competitivePositioning: ""
  },
  businessModel: {
    revenueModel: "",
    revenueStreams: "",
    pricingStrategy: "",
    unitEconomics: "",
    scalability: "",
    verticalIntegration: ""
  },
  supplyAndInput: {
    supplierConcentration: "",
    rawMaterialDependencies: "",
    procurementStrategy: "",
    supplierNegotiatingPower: ""
  },
  operations: {
    operationalModel: "",
    manufacturingOrDelivery: "",
    capacityUtilization: "",
    qualityControl: "",
    geographicFootprint: ""
  },
  distribution: {
    distributionChannels: "",
    channelMix: "",
    logisticsAndFulfillment: "",
    partnerNetworks: ""
  },
  salesAndMarketing: {
    goToMarketStrategy: "",
    salesModel: "",
    marketingStrategy: "",
    brandStrength: "",
    customerAcquisitionCost: ""
  },
  customerAndService: {
    targetCustomerSegments: "",
    customerLifetimeValue: "",
    netPromoterScore: "",
    churnRate: "",
    customerSupportModel: "",
    switchingCosts: ""
  },
  financials: {
    revenue: "",
    revenueGrowthRate: "",
    grossMargin: "",
    ebitda: "",
    netIncome: "",
    cashPosition: "",
    debtLoad: "",
    capitalExpenditure: "",
    returnOnEquity: "",
    valuationMultiple: ""
  },
  competition: {
    primaryCompetitors: "",
    competitiveAdvantages: "",
    competitiveThreats: "",
    barriersToEntry: "",
    industryConsolidation: ""
  },
  risksAndFuture: {
    keyRisks: "",
    regulatoryEnvironment: "",
    macroTailwinds: "",
    macroHeadwinds: "",
    futureBets: "",
    mAndAOpportunities: ""
  }
};

function stripMarkdownFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

app.post('/api/analyze', async (req, res) => {
  const { companyName } = req.body || {};

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'Company name is required.' });
  }

  const name = companyName.trim();

  const prompt = `Analyze "${name}" and fill in every field of the following JSON schema with 1-3 sentences specific to ${name}. Use "(estimated)" for any uncertain figures. Return ONLY the completed JSON object.

Schema to fill:
${JSON.stringify(SCHEMA_TEMPLATE, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 16384,
      },
      contents: prompt,
    });

    const rawText = response.text;
    const cleaned = stripMarkdownFences(rawText);

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed. Raw response snippet:', cleaned.slice(0, 400));
      return res.status(500).json({
        error: 'Gemini returned a response that could not be parsed as JSON. Try again.',
        snippet: cleaned.slice(0, 300),
      });
    }

    res.json({ analysis });
  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: err.message || 'Gemini API call failed.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
