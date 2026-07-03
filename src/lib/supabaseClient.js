import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function normalizeSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Already correct
  if (url.startsWith('https://')) return url;

  // Sometimes users paste the Postgres connection string instead of the REST URL.
  // Convert db.<ref>.supabase.co -> https://<ref>.supabase.co
  if (url.startsWith('postgresql://')) {
    try {
      const parsed = new URL(url);
      const parts = parsed.hostname.split('.');
      if (parts.length >= 4 && parts[0] === 'db') {
        const ref = parts[1];
        return `https://${ref}.supabase.co`;
      }
    } catch {
      // fall through
    }
  }

  return url;
}

export function getSupabaseConfig() {
  return { url: normalizeSupabaseUrl(rawUrl), anonKey: supabaseAnonKey, rawUrl };
}

export function isValidSupabaseUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createSupabaseClient(token) {
  const { url, anonKey } = getSupabaseConfig();

  if (!isValidSupabaseUrl(url) || !anonKey) {
    throw new Error(
      'Supabase quraşdırması çatışır və ya yanlışdır. Zəhmət olmasa .env faylında VITE_SUPABASE_URL və VITE_SUPABASE_ANON_KEY dəyərlərini yoxlayın.'
    );
  }

  return createClient(url, anonKey, {
    global: {
      // We use a custom "Pethub" Authorization scheme so the token is sent on
      // every request without conflicting with Supabase Auth's Bearer JWTs.
      headers: token ? { Authorization: `Pethub ${token}` } : {},
    },
    auth: {
      // We use a custom auth flow; disable the built-in session persistence.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// SEC-014: USER_KEY intentionally removed.
// The user object is never persisted to localStorage.
// On page load, the session is always re-validated via the me() RPC.
export const TOKEN_KEY = 'pethub_token';
