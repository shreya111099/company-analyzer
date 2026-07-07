// Tiny in-memory TTL cache with LRU-ish eviction. Cuts cost/latency for repeated
// queries and blunts abuse (re-running the same analysis is instant and free).
// Swap for Redis/Supabase later if you need cross-instance caching.

const TTL_MS = (Number(process.env.CACHE_TTL_MIN) || 1440) * 60 * 1000; // default 24h
const MAX_ENTRIES = Number(process.env.CACHE_MAX) || 500;

const store = new Map(); // key -> { value, expires }

export function cacheKey(parts) {
  return JSON.stringify(parts).toLowerCase();
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  // Touch for LRU: re-insert to move to the end.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function cacheSet(key, value) {
  if (store.has(key)) store.delete(key);
  else if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value; // evict least-recently-used
    store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + TTL_MS });
}
