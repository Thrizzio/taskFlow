/**
 * Environment-configurable API base URL.
 * Defaults to http://localhost:4000 for local development.
 * In production builds or staging, set VITE_API_URL.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000';

