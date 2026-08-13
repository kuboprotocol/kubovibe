import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Avoid accessing browser-only globals (localStorage, window) at import time so tests
// and server-side environments don't throw ReferenceError.
const SUPABASE_URL = typeof process !== 'undefined' ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '') : '';
const SUPABASE_ANON_KEY = typeof process !== 'undefined' ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '') : '';

// Create the client with session persistence disabled by default so it doesn't try to
// use localStorage when used in Node/test environments. Callers in the browser can
// still use the client normally.
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
