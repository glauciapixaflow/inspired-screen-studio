import { getMyRole } from "@/lib/user-profiles";

class AdminReauthenticationError extends Error {}

export async function verifyAdminPassword(expectedUserId: string, password: string): Promise<void> {
  if (!password) throw new AdminReauthenticationError("Digite sua senha para continuar.");
  const { supabase, createPasswordVerificationClient } = await import("@/lib/supabase");
  const { data: current, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || current.user?.id !== expectedUserId || !current.user.email) {
    throw new AdminReauthenticationError(
      "Sua sessão mudou ou expirou. Entre novamente na sua conta.",
    );
  }
  if ((await getMyRole()) !== "admin") {
    throw new AdminReauthenticationError("Somente administradores podem abrir este painel.");
  }
  const verifier = createPasswordVerificationClient();
  try {
    const { data, error } = await verifier.auth.signInWithPassword({
      email: current.user.email,
      password,
    });
    if (error || !data.session || data.user?.id !== expectedUserId) {
      throw new AdminReauthenticationError(
        "Não foi possível confirmar a senha desta conta. Confira e tente novamente.",
      );
    }
    // Verify the original session and role again in case the account changed meanwhile.
    const { data: after, error: afterError } = await supabase.auth.getUser();
    if (afterError || after.user?.id !== expectedUserId) {
      throw new AdminReauthenticationError("Sua sessão mudou. Entre novamente na sua conta.");
    }
    if ((await getMyRole()) !== "admin") {
      throw new AdminReauthenticationError("Seu acesso de administrador foi removido.");
    }
  } catch (error) {
    if (error instanceof AdminReauthenticationError) throw error;
    throw new AdminReauthenticationError(
      "Não foi possível confirmar sua senha. Tente novamente em instantes.",
    );
  } finally {
    // Revoke only the temporary verification session; keep the user's site session.
    await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
