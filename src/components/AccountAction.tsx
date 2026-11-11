import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";

export function AccountAction() {
  const { user, role, loading } = useUserRole();
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
      await cache.cancelQueries({ queryKey: ["reservation-chats"] });
      cache.removeQueries({ queryKey: ["reservation-chats"] });
      await cache.cancelQueries({ queryKey: ["team-reservations"] });
      cache.removeQueries({ queryKey: ["team-reservations"] });
      await cache.cancelQueries({ queryKey: ["admin-users"] });
      cache.removeQueries({ queryKey: ["admin-users"] });
      cache.removeQueries({ queryKey: ["commercial-terms"] });
      cache.removeQueries({ queryKey: ["user-role"] });
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
    <span className="flex flex-wrap items-center gap-4 text-sm">
      <Link to="/chat" className="font-semibold underline underline-offset-4">
        Conversas
      </Link>
      {(role === "admin" || role === "collaborator") && (
        <Link to="/atendimento" className="font-semibold underline underline-offset-4">
          Atendimento
        </Link>
      )}
      {role === "admin" && (
        <Link
          to="/admin"
          className="inline-flex items-center rounded-md border border-current/40 px-3 py-2 font-semibold transition hover:bg-current/10"
        >
          Administração
        </Link>
      )}
      {role === "admin" && (
        <Link to="/condicoes-comerciais" className="font-semibold underline underline-offset-4">
          Condições comerciais
        </Link>
      )}
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
