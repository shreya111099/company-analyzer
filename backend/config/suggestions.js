// Curated seed lists for autocomplete. These give instant, on-topic suggestions
// for common queries; the /api/suggest endpoint merges them with live web
// suggestions for long-tail coverage.

export const COMPANIES = [
  'Apple', 'Microsoft', 'Alphabet (Google)', 'Amazon', 'Meta', 'Nvidia', 'Tesla',
  'Netflix', 'Adobe', 'Salesforce', 'Oracle', 'IBM', 'Intel', 'AMD', 'Qualcomm',
  'TSMC', 'ASML', 'Samsung', 'Sony', 'Cisco', 'Broadcom', 'SAP', 'ServiceNow',
  'Stripe', 'PayPal', 'Block (Square)', 'Visa', 'Mastercard', 'Coinbase',
  'Shopify', 'Uber', 'Airbnb', 'DoorDash', 'Instacart', 'Spotify', 'Snowflake',
  'Databricks', 'Palantir', 'Datadog', 'MongoDB', 'Atlassian', 'Zoom', 'Slack',
  'OpenAI', 'Anthropic', 'Hugging Face', 'Figma', 'Notion', 'Canva', 'Reddit',
  'Pinterest', 'Snap', 'ByteDance (TikTok)', 'Alibaba', 'Tencent', 'JPMorgan Chase',
  'Goldman Sachs', 'Berkshire Hathaway', 'Walmart', 'Costco', 'Nike', 'Starbucks',
  'McDonald’s', 'Coca-Cola', 'PepsiCo', 'Procter & Gamble', 'Disney',
  'Boeing', 'Airbus', 'Ford', 'General Motors', 'Rivian', 'BYD', 'ChargePoint',
  'Pfizer', 'Moderna', 'Johnson & Johnson', 'UnitedHealth', 'Exxon Mobil',
];

export const SECTORS = [
  'Artificial intelligence', 'Cloud infrastructure', 'Cybersecurity', 'Fintech',
  'Semiconductors', 'Electric vehicles', 'EV charging', 'Renewable energy',
  'Solar energy', 'Battery technology', 'E-commerce', 'Streaming media',
  'Social media', 'Digital advertising', 'SaaS', 'Enterprise software',
  'Data infrastructure', 'Quantum computing', 'Robotics', 'Autonomous vehicles',
  'Space technology', 'Biotechnology', 'Pharmaceuticals', 'Digital health',
  'Medical devices', 'Health insurance', 'Ride-sharing', 'Food delivery',
  'Online travel', 'Gaming', 'Cryptocurrency', 'Digital payments',
  'Buy now pay later', 'Insurtech', 'Real estate tech', 'AgTech',
  'Supply chain & logistics', 'Consumer electronics', 'Cloud gaming',
  'Generative AI', 'AI chips', 'Data centers', 'Telecommunications',
  '5G', 'Smart home', 'Wearables', 'Video conferencing',
];

// Case-insensitive match: prefix matches first, then substring matches.
export function matchCurated(list, q, limit) {
  const needle = q.toLowerCase();
  const prefix = [];
  const contains = [];
  for (const item of list) {
    const lower = item.toLowerCase();
    if (lower.startsWith(needle)) prefix.push(item);
    else if (lower.includes(needle)) contains.push(item);
  }
  return [...prefix, ...contains].slice(0, limit);
}
