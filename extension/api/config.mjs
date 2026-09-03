// Viscue API and Web Configuration

export const VISCUE_WEB_URL =
  (typeof process !== 'undefined' && process.env?.VITE_VISCUE_WEB_URL) ||
  'https://viscue.com';

export const VISCUE_API_URL = `${VISCUE_WEB_URL}/api`;

export const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://vqqaxhzqaehjdpoefrjc.supabase.co';

export const CLIENT_ID = 'viscue-extension';
