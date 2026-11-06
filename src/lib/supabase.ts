import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configure a URL e a chave do Supabase no .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Password verification must not replace or persist the site's current session.
export function createPasswordVerificationClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `admin-password-verification-${crypto.randomUUID()}`,
    },
  });
}
