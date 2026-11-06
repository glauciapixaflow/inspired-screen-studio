import { createClient } from "@supabase/supabase-js";

const invalidLink = "Este link de recuperação é inválido ou venceu. Solicite um novo e-mail.";
export async function requestPasswordRecovery(email: string) {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin + "/redefinir-senha",
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      throw new Error("O limite de solicitações foi atingido. Aguarde antes de tentar novamente.");
    }
    throw new Error("Não foi possível solicitar a recuperação. Tente novamente em instantes.");
  }
}

export type PasswordRecoveryAccess = {
  updatePassword: (password: string) => Promise<void>;
  close: () => Promise<void>;
};

// No shared browser session is used, and recovery tokens stay only in memory.
export async function openPasswordRecovery(fragment: string): Promise<PasswordRecoveryAccess> {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (params.has("error") || params.get("type") !== "recovery" || !accessToken || !refreshToken)
    throw new Error(invalidLink);
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Não foi possível conectar ao serviço de recuperação.");
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `password-recovery-${crypto.randomUUID()}`,
    },
  });
  let closed = false;
  const close = async () => {
    closed = true;
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* No credentials are persisted. */
    }
  };
  try {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session || !data.user) throw new Error(invalidLink);
    const userId = data.user.id;
    const verified = await client.auth.getUser();
    if (verified.error || verified.data.user?.id !== userId) throw new Error(invalidLink);
    return {
      close,
      updatePassword: async (password) => {
        if (closed) throw new Error(invalidLink);
        if (password.length < 8) throw new Error("Use uma senha com pelo menos 8 caracteres.");
        const current = await client.auth.getUser();
        if (current.error || current.data.user?.id !== userId) throw new Error(invalidLink);
        const updated = await client.auth.updateUser({ password });
        if (updated.error) {
          if (updated.error.code === "weak_password")
            throw new Error("Escolha uma senha mais forte, com letras, números e símbolos.");
          if (updated.error.code === "same_password")
            throw new Error("Escolha uma senha diferente da anterior.");
          if (
            ["session_not_found", "refresh_token_not_found", "bad_jwt"].includes(
              updated.error.code ?? "",
            )
          )
            throw new Error(invalidLink);
          throw new Error("Não foi possível salvar a nova senha. Tente novamente.");
        }
        if (updated.data.user?.id !== userId)
          throw new Error("Não foi possível verificar a alteração da senha.");
        await close();
      },
    };
  } catch (error) {
    await close();
    throw error instanceof Error && error.message === invalidLink ? error : new Error(invalidLink);
  }
}
