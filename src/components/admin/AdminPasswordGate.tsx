import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { verifyAdminPassword } from "@/lib/admin-reauthentication";

export function AdminPasswordGate({ children }: { children: ReactNode }) {
  const { user, role, loading, error } = useUserRole();
  const cache = useQueryClient();
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setVerifiedFor(null);
    setPassword("");
    setMessage("");
    setBusy(false);
    return () => {
      generation.current += 1;
    };
  }, [user?.id, role]);

  useEffect(
    () => () => {
      void cache.cancelQueries({ queryKey: ["admin-users"] });
      cache.removeQueries({ queryKey: ["admin-users"] });
    },
    [cache],
  );

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user || role !== "admin") return;
    const attempt = generation.current;
    const accountId = user.id;
    setBusy(true);
    setMessage("");
    try {
      await verifyAdminPassword(accountId, password);
      if (attempt === generation.current) setVerifiedFor(accountId);
    } catch (failure) {
      if (attempt === generation.current)
        setMessage(
          failure instanceof Error ? failure.message : "Não foi possível confirmar sua senha.",
        );
    } finally {
      if (attempt === generation.current) {
        setPassword("");
        setBusy(false);
      }
    }
  }

  if (!loading && !error && role === "admin" && user && verifiedFor === user.id)
    return <>{children}</>;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-7 text-ink-foreground lg:px-10">
        <Logo />
        <Link to="/inicio" className="text-sm font-semibold">
          Voltar ao site
        </Link>
      </header>
      <div className="mx-auto max-w-lg px-6 py-16 sm:py-24">
        <p className="eyebrow flex items-center gap-3 text-muted-foreground">
          <LockKeyhole size={16} /> Administração
        </p>
        <h1 className="font-display mt-6 text-4xl sm:text-5xl">Confirme seu acesso</h1>
        {loading ? (
          <p role="status" className="mt-6">
            Verificando sua conta...
          </p>
        ) : error ? (
          <div className="mt-6 space-y-4">
            <p role="alert">Não foi possível verificar seu acesso.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        ) : !user ? (
          <div className="mt-6 space-y-4">
            <p>Entre na sua conta antes de acessar a administração.</p>
            <Button asChild>
              <Link to="/">Entrar</Link>
            </Button>
          </div>
        ) : role !== "admin" ? (
          <div className="mt-6 space-y-4">
            <p role="alert">Esta área é exclusiva de administradores.</p>
            <Link to="/inicio" className="underline">
              Voltar à página inicial
            </Link>
          </div>
        ) : (
          <form method="post" onSubmit={unlock} className="mt-8 space-y-5">
            <p className="text-muted-foreground">
              Digite novamente a senha da sua conta para abrir o painel.
            </p>
            <label htmlFor="admin-account" className="block text-sm font-semibold">
              Conta
            </label>
            <input
              id="admin-account"
              type="email"
              autoComplete="username"
              value={user.email ?? ""}
              readOnly
              className="w-full rounded-md border border-input bg-muted px-4 py-3 text-sm"
            />
            <label htmlFor="admin-password" className="block text-sm font-semibold">
              Sua senha
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-input bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            {message && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Confirmando..." : "Confirmar e abrir administração"}
            </Button>
            <Link to="/inicio" className="block text-center text-sm underline">
              Cancelar e voltar ao site
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
