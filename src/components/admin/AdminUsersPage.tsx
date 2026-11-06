import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import {
  ADMIN_PAGE_SIZE,
  changeUserRole,
  listAdminUsers,
  ROLE_LABELS,
  type AdminUser,
  type AppRole,
} from "@/lib/user-profiles";

function RoleEditor({
  account,
  viewerId,
  busy,
  onSave,
}: {
  account: AdminUser;
  viewerId: string;
  busy: boolean;
  onSave: (account: AdminUser, role: AppRole) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AppRole>(account.role);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const label = account.email ?? account.user_id;
  async function save() {
    setError("");
    try {
      await onSave(account, draft);
      setConfirming(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar o perfil.");
    }
  }
  return (
    <div className="mt-6 border-t border-border pt-5">
      <label htmlFor={`role-${account.user_id}`} className="text-sm font-semibold">
        Perfil de acesso
      </label>
      <select
        id={`role-${account.user_id}`}
        aria-label={`Perfil de ${label}`}
        value={draft}
        disabled={busy || confirming}
        onChange={(event) => {
          setDraft(event.target.value as AppRole);
          setError("");
        }}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      >
        {Object.entries(ROLE_LABELS).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {confirming ? (
        <div className="mt-4 space-y-3" aria-label={`Confirmar perfil de ${label}`}>
          <p className="text-sm">
            Alterar o perfil de <strong>{label}</strong> de {ROLE_LABELS[account.role]} para{" "}
            <strong>{ROLE_LABELS[draft]}</strong>?
          </p>
          {account.user_id === viewerId && draft !== "admin" && (
            <p className="text-sm text-muted-foreground">
              Você perderá o acesso à administração. É necessário manter outro administrador.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Salvando..." : "Confirmar alteração"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={busy || draft === account.role}
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          Salvar perfil
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const { user, role, loading, error } = useUserRole();
  const cache = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AppRole | "all">("all");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const allowed = !!user && role === "admin" && !loading && !error;
  const listing = useQuery({
    queryKey: ["admin-users", user?.id, search, filter, page],
    queryFn: () => listAdminUsers(search, filter === "all" ? null : filter, page),
    enabled: allowed,
    retry: false,
    refetchInterval: 30_000,
  });
  const mutation = useMutation({
    mutationFn: ({ account, next }: { account: AdminUser; next: AppRole }) =>
      changeUserRole(account.user_id, next),
    retry: false,
  });
  async function saveRole(account: AdminUser, next: AppRole) {
    const saved = await mutation.mutateAsync({ account, next });
    setNotice(
      `Perfil de ${account.email ?? account.user_id} alterado para ${ROLE_LABELS[saved.role]}.`,
    );
    if (account.user_id === user?.id) cache.setQueryData(["user-role", user.id], saved.role);
    // Hide stale privileged data immediately if the administrator demotes themselves.
    if (account.user_id === user?.id && saved.role !== "admin") {
      await cache.cancelQueries({ queryKey: ["admin-users"] });
      cache.removeQueries({ queryKey: ["admin-users"] });
    } else {
      setPage(0);
      void cache.invalidateQueries({ queryKey: ["admin-users"] });
    }
    void cache.invalidateQueries({ queryKey: ["user-role"] });
  }
  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(0);
    setNotice("");
  }
  const total = Number(listing.data?.[0]?.total_count ?? 0);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-7 text-ink-foreground lg:px-10">
        <Logo />
        <Link to="/inicio" className="flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} /> Voltar ao site
        </Link>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-10">
        <p className="eyebrow flex items-center gap-3 text-muted-foreground">
          <ShieldCheck size={16} /> Administração
        </p>
        <h1 className="font-display mt-6 text-5xl sm:text-7xl">Pessoas e perfis</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Organize quem pode administrar o site e quem fará parte da equipe de atendimento.
        </p>
        {loading ? (
          <p role="status" className="mt-10">
            Verificando seu acesso...
          </p>
        ) : error ? (
          <div className="mt-10 space-y-4">
            <p role="alert">Não foi possível verificar seu acesso.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        ) : !user ? (
          <div className="mt-10 space-y-4">
            <p>Entre na sua conta para acessar a administração.</p>
            <Button asChild>
              <Link to="/">Entrar</Link>
            </Button>
          </div>
        ) : !allowed ? (
          <div className="mt-10 border border-border bg-card p-6">
            <h2 className="text-xl">Acesso restrito</h2>
            <p className="mt-3 text-muted-foreground">Esta área é exclusiva de administradores.</p>
            <Link to="/inicio" className="mt-5 inline-block underline">
              Voltar ao site
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={searchUsers}
              className="mt-10 grid items-end gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-[1fr_auto] lg:grid-cols-[1fr_220px_auto]"
            >
              <div>
                <label htmlFor="admin-search" className="text-sm font-semibold">
                  Buscar usuário
                </label>
                <input
                  id="admin-search"
                  type="search"
                  maxLength={200}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="E-mail ou ID do usuário"
                  className="mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="admin-filter" className="text-sm font-semibold">
                  Filtrar por perfil
                </label>
                <select
                  id="admin-filter"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as AppRole | "all");
                    setPage(0);
                    setNotice("");
                  }}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todos os perfis</option>
                  {Object.entries(ROLE_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="h-11">
                <Search size={16} /> Buscar
              </Button>
            </form>
            {notice && (
              <p
                role="status"
                className="mt-6 rounded-md border border-primary/25 bg-card p-4 text-sm"
              >
                {notice}
              </p>
            )}
            {listing.isPending ? (
              <p role="status" className="mt-10">
                Carregando usuários...
              </p>
            ) : listing.isError ? (
              <div className="mt-8 space-y-4">
                <p role="alert">{listing.error.message}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    void listing.refetch();
                    void cache.invalidateQueries({ queryKey: ["user-role"] });
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users size={16} />
                    {total} {total === 1 ? "usuário encontrado" : "usuários encontrados"}
                  </p>
                  <Button
                    variant="ghost"
                    disabled={listing.isFetching || mutation.isPending}
                    onClick={() => {
                      void listing.refetch();
                    }}
                  >
                    Atualizar lista
                  </Button>
                </div>
                {!listing.data?.length ? (
                  <p className="mt-6 border border-dashed border-border p-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado. Tente outro e-mail, ID ou perfil.
                  </p>
                ) : (
                  <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {listing.data.map((account) => (
                      <li
                        key={`${account.user_id}-${account.role}`}
                        className="min-w-0 rounded-lg border border-border bg-card p-6"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                            {ROLE_LABELS[account.role]}
                          </span>
                          {account.user_id === user.id && (
                            <span className="text-xs text-muted-foreground">Sua conta</span>
                          )}
                        </div>
                        <h2 className="mt-5 break-all text-lg font-semibold">
                          {account.email ?? "Usuário sem e-mail"}
                        </h2>
                        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                          {account.user_id}
                        </p>
                        <p className="mt-4 text-sm text-muted-foreground">
                          Cadastro:{" "}
                          {new Intl.DateTimeFormat("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          }).format(new Date(account.created_at))}
                        </p>
                        <RoleEditor
                          account={account}
                          viewerId={user.id}
                          busy={mutation.isPending}
                          onSave={saveRole}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <nav
                  aria-label="Paginação de usuários"
                  className="mt-8 flex flex-wrap items-center justify-between gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={page === 0 || mutation.isPending}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">Página {page + 1}</span>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * ADMIN_PAGE_SIZE >= total || mutation.isPending}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Próxima <ChevronRight size={16} />
                  </Button>
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
