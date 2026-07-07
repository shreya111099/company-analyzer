// Base URL for the backend API.
// - Local dev: empty, so requests hit "/api/..." and Vite proxies to :3001.
// - Production: set VITE_API_BASE to the deployed backend URL (e.g. the Render
//   service URL). Cross-origin requests work because the backend enables CORS.
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

export const api = (path) => `${API_BASE}${path}`;
