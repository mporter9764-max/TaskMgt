import { createClient } from "@supabase/supabase-js";

// Read public env vars. These are safe to expose in the browser for a
// no-login app (the anon key + RLS policies are the access model).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// isConfigured lets the UI show a friendly setup screen instead of crashing
// when .env.local hasn't been filled in yet.
export const isConfigured = Boolean(url && key);

// Fall back to a syntactically-valid placeholder so importing this module
// never throws during build. Real values come from .env.local at runtime.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-anon-key"
);
