import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/use-user-role";
import {
  ChevronDown,
  Headset,
  LogOut,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const adminLinks = [
  { to: "/admin", label: "Administração", icon: Users },
  { to: "/atendimento", label: "Atendimento", icon: Headset },
  { to: "/chat", label: "Conversas", icon: MessageCircle },
  { to: "/condicoes-comerciais", label: "Condições comerciais", icon: SlidersHorizontal },
] as const;

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
  if (role === "admin")
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label="Menu do administrador"
            className="h-11 shrink-0 gap-2 border border-current/30 px-3 text-inherit hover:bg-white/10 hover:text-inherit data-[state=open]:bg-white/10"
          >
            <ShieldCheck aria-hidden="true" />
            <span className="hidden sm:inline">Administrador</span>
            <ChevronDown aria-hidden="true" className="hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="w-64 max-w-[calc(100vw-2rem)] p-2"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Gerenciar o site
          </DropdownMenuLabel>
          {adminLinks.map(({ to, label, icon: Icon }) => (
            <DropdownMenuItem key={to} asChild className="min-h-11 cursor-pointer">
              <Link
                to={to}
                activeProps={{
                  className: "bg-accent font-semibold text-accent-foreground",
                  "aria-current": "page",
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busy}
            className="min-h-11 cursor-pointer text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            <LogOut aria-hidden="true" />
            {busy ? "Saindo..." : "Sair da conta"}
          </DropdownMenuItem>
          {failed && (
            <p role="alert" className="px-2 py-2 text-xs text-destructive">
              Não foi possível sair. Tente novamente.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  return (
    <span className="flex flex-wrap items-center gap-4 text-sm">
      <Link to="/chat" className="font-semibold underline underline-offset-4">
        Conversas
      </Link>
      {role === "collaborator" && (
        <Link to="/atendimento" className="font-semibold underline underline-offset-4">
          Atendimento
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
