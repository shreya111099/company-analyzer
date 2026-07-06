# Strategic Analyzer

A **multi-agent, multi-model** strategic analysis tool. Analyze either a **company** or a whole
**sector/industry** across the full **Tech + Business Value Chain** framework. Twelve independent
domain agents fan out in parallel across free-tier models, then a synthesis agent produces an
executive assessment.

## What it does

Pick a mode (**Company** or **Sector**), enter a name, and watch ~14 agents run live:

1. A **framing agent** establishes shared context (definition, segments/competitors, scale).
2. **12 domain agents** each analyze one value-chain dimension in parallel — Tech Value Chain,
   AI Innovation, Strategy & Market, Business Model, Supply, Operations, Distribution, Sales &
   Marketing, Customer/Service, Financials, Competition, Risks & Future (~60 fields total).
3. A **synthesis agent** returns an executive summary, key strengths/weaknesses, strategic
   recommendations, and diligence questions.

Agents are distributed across providers to stay **free** and spread each provider's rate limits.
Results stream in live (per-agent progress), render as a synthesis card plus collapsible
accordions with a per-section model badge, and export via **"Copy as interview notes"**.

### Multi-model setup (all free tier)

| Agents | Provider | Model |
|--------|----------|-------|
| ~6 domain agents | **Groq** | `llama-3.3-70b-versatile` |
| ~6 domain agents | **Hugging Face** | `meta-llama/Llama-3.1-8B-Instruct` |
| Framing + Synthesis | **Google Gemini** | `gemini-2.5-flash` |

Missing keys **fall back to Gemini**, so the app runs with just `GEMINI_API_KEY` — but Gemini's
free tier is tight (5 req/min, 20/day), so adding the free Groq + HF keys is recommended.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A free Gemini API key (see below)

---

## Getting a free Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **"Get API key"** in the left sidebar → **"Create API key"**
4. Copy the key — it starts with `AIza…`

The free tier (Gemini 2.5 Flash) is sufficient for this app.

---

## Setup

### 1. Clone / download the project

```bash
cd company-analyzer
```

### 2. Install root dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd backend && npm install && cd ..
```

### 4. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

### 5. Add your Gemini API key

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and add your keys:

```
GEMINI_API_KEY=AIzaSy...yourkey...   # required
GROQ_API_KEY=gsk_...                 # optional, free at console.groq.com
HF_TOKEN=hf_...                      # optional, free at huggingface.co/settings/tokens
AGENT_CONCURRENCY=4
PORT=3001
```

`GROQ_API_KEY` and `HF_TOKEN` are optional but recommended — without them all agents fall back
to Gemini and quickly hit its free-tier limit.

---

## Running the app

From the project root:

```bash
npm run dev
```

This starts both servers concurrently:

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:5173   |
| Backend  | http://localhost:3001   |

Open **http://localhost:5173** in your browser, type a company name, and click **Analyze**.

> **Note:** Each analysis fans out ~14 model calls across providers. Expect **20–45 seconds**
> for a full run; agents stream in live as they complete, and any that fail (usually a free-tier
> rate limit) are marked "unavailable" without blocking the rest.

---

## Project structure

```
company-analyzer/
├── backend/
│   ├── index.js              # Express server: SSE stream + JSON fallback
│   ├── orchestrator.js       # framing → parallel fan-out → merge → synthesis
│   ├── providers.js          # unified callModel across Gemini / Groq / HF (+ retry, fallback)
│   ├── agents/registry.js    # 14 agent definitions + provider assignment
│   ├── config/schema.js      # the 12 value-chain domains (shared source of truth)
│   ├── .env / .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # mode toggle + SSE consumption + results
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── ModeToggle.jsx
│   │   │   ├── ProgressTracker.jsx
│   │   │   ├── SynthesisCard.jsx
│   │   │   └── AccordionSection.jsx
│   │   └── utils/
│   │       └── schema.js     # section labels + synthesis shape + copy formatter
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json              # Root scripts (concurrently)
└── README.md
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `GEMINI_API_KEY` missing error | Make sure `backend/.env` exists and has the key |
| Response fails to parse | Gemini occasionally returns non-JSON; retry usually works |
| Analysis cuts off mid-field | The 8192 token limit should be sufficient; contact support if consistently truncated |
| CORS error in browser | Make sure the backend is running on port 3001 |
