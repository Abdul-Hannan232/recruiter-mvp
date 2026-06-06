import { createClient } from "@supabase/supabase-js";

// Browser-safe: the anon (publishable) key is designed to ship to the client.
// Real authorization is enforced server-side (FastAPI verifies the JWT + resolves
// the recruiter role) and by Postgres RLS — never trust the client's claimed role.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced loudly in dev; without these the auth UI cannot function.
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // session survives reloads (localStorage)
    autoRefreshToken: true, // supabase-js refreshes the access token before expiry
    detectSessionInUrl: true, // needed if email-confirm / magic links are ever enabled
    storageKey: "recruiterAI.auth",
  },
});
