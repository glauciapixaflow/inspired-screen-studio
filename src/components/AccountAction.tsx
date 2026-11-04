import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";

export function AccountAction() {
  const { user, loading } = useAuthUser();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cache = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      cache.removeQueries({ queryKey: ["area-reservations"] });
      await navigate({ to: "/" });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <span className="text-sm">Verificando conta...</span>;
  if (!user)
    return (
      <Link to="/" className="text-sm underline">
        Entrar
      </Link>
    );
  return (
    <span className="text-sm">
      <button type="button" onClick={signOut} disabled={busy}>
        {busy ? "Saindo..." : "Sair da conta"}
      </button>
      {failed && (
        <span role="alert" className="ml-2">
          Não foi possível sair. Tente novamente.
        </span>
      )}
    </span>
  );
}
