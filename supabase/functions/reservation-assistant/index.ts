import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createAssistantHandler } from "./handler.ts";

Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service)
    return new Response(JSON.stringify({ error: "Atendimento indisponível." }), {
      status: 503,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const auth = createClient(url, anon, options);
  const admin = createClient(url, service, options);
  return createAssistantHandler({
    authenticate: async (token) => {
      const { data, error } = await auth.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    rpc: async (name, args) => {
      const { data, error } = await admin.rpc(name, args);
      return { data, error };
    },
    apiKey: Deno.env.get("GEMINI_API_KEY")?.trim(),
    model: Deno.env.get("GEMINI_MODEL")?.trim(),
    report: (event) => console.warn(JSON.stringify({ event: "assistant_failure", ...event })),
  })(request);
});
