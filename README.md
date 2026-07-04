# Company Analyzer

An MBA case-interview tool that analyzes any company across a full **Tech + Business Value Chain** framework using Google Gemini 2.5 Flash.

## What it does

Enter a company name and get a structured analysis across 11 categories (~60 fields):

- Tech Value Chain (R&D, architecture, data moat, AI/ML…)
- Strategy & Market (TAM, market share, network effects…)
- Business Model (revenue streams, unit economics…)
- Supply / Input, Operations, Distribution
- Sales & Marketing, Customer / Service
- Financials (revenue, margins, valuation…)
- Competition, Risks & Future

Results display as collapsible accordion sections. A **"Copy as interview notes"** button exports clean plain text.

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

Open `backend/.env` and replace `your_api_key_here` with your actual key:

```
GEMINI_API_KEY=AIzaSy...yourkey...
PORT=3001
```

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

> **Note:** Each analysis makes one large Gemini call (up to 8,192 output tokens). Expect **15–30 seconds** for a full response.

---

## Project structure

```
company-analyzer/
├── backend/
│   ├── index.js          # Express server + Gemini call
│   ├── .env              # Your API key (git-ignored)
│   ├── .env.example      # Template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── AccordionSection.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   └── utils/
│   │       └── schema.js   # Section/field definitions + copy formatter
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json          # Root scripts (concurrently)
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
