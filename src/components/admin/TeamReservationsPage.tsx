import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Headset, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { useReservationClock } from "@/hooks/use-reservation-clock";
import { LOTES } from "@/lib/mars-regions";
import {
  formatDeadline,
  isReservationActive,
  negotiationDeadline,
  reservationStatus,
} from "@/lib/reservations";
import {
  confirmReservationContact,
  listTeamReservations,
  resolveReservation,
  type ReservationDecision,
  TEAM_PAGE_SIZE,
  type TeamReservation,
  type ReservationStatus,
} from "@/lib/team-reservations";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending_contact: "Aguardando contato",
  contacted: "Contato confirmado",
  expired: "Reserva expirada",
  confirmed: "Reserva confirmada",
  deactivated: "Reserva desativada",
  cancelled: "Reserva cancelada",
};

function ContactForm({
  reservation,
  busy,
  onConfirm,
}: {
  reservation: TeamReservation;
  busy: boolean;
  onConfirm: (reservation: TeamReservation, notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await onConfirm(reservation, notes);
      setConfirming(false);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível confirmar o contato.",
      );
    }
  }
  return (
    <div className="mt-5 border-t border-border pt-5">
      <label htmlFor={`notes-${reservation.id}`} className="text-sm font-semibold">
        Observação interna (opcional)
      </label>
      <textarea
        id={`notes-${reservation.id}`}
        value={notes}
        maxLength={2000}
        disabled={busy || confirming}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        placeholder="Registre um resumo do contato com o cliente."
        className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
      <p className="mt-1 text-right text-xs text-muted-foreground">{notes.length}/2000</p>
      {confirming ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            Confirma que o cliente já entrou em contato sobre esta reserva? A reserva continuará
            ativa para negociação.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Registrando..." : "Registrar confirmação"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-3 w-full"
          disabled={busy}
          onClick={() => {
            setConfirming(true);
            setError("");
          }}
        >
          Confirmar contato
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

function ResolutionForm({
  reservation,
  busy,
  onResolve,
}: {
  reservation: TeamReservation;
  busy: boolean;
  onResolve: (
    reservation: TeamReservation,
    decision: ReservationDecision,
    notes: string,
  ) => Promise<void>;
}) {
  const [decision, setDecision] = useState<ReservationDecision>("confirmed");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await onResolve(reservation, decision, notes);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível encerrar.");
    }
  }
  return (
    <div className="mt-5 space-y-3 border-t border-border pt-5">
      <label htmlFor={`decision-${reservation.id}`} className="block font-semibold">
        Encerrar negociação
      </label>
      <select
        id={`decision-${reservation.id}`}
        value={decision}
        disabled={busy || review}
        onChange={(event) => setDecision(event.target.value as ReservationDecision)}
        className="w-full rounded-md border border-input bg-background p-3"
      >
        <option value="confirmed">Confirmar reserva</option>
        <option value="deactivated">Desativar e liberar área</option>
      </select>
      <label htmlFor={`resolution-note-${reservation.id}`} className="block">
        Observação do encerramento (opcional)
      </label>
      <textarea
        id={`resolution-note-${reservation.id}`}
        value={notes}
        maxLength={2000}
        disabled={busy || review}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background p-3"
      />
      {review ? (
        <div className="space-y-3">
          <p>
            {decision === "confirmed"
              ? "Confirmar definitivamente esta reserva? A área continuará indisponível."
              : "Desativar esta reserva? A área será liberada para novas reservas."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Salvando..." : "Concluir negociação"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => {
            setReview(true);
            setError("");
          }}
        >
          Revisar encerramento
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function TeamReservationsPage() {
  const { user, role, loading, error } = useUserRole();
  const cache = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReservationStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const allowed = !!user && !loading && !error && (role === "admin" || role === "collaborator");
  const listing = useQuery({
    queryKey: ["team-reservations", user?.id, search, filter, page],
    queryFn: () => listTeamReservations(search, filter === "all" ? null : filter, page),
    enabled: allowed,
    retry: false,
    refetchInterval: 30_000,
  });
  const now = useReservationClock(
    (listing.data ?? []).flatMap((row) => [
      row.expires_at,
      ...(negotiationDeadline(row) ? [negotiationDeadline(row)!] : []),
    ]),
  );
  const mutation = useMutation({
    mutationFn: ({ reservation, notes }: { reservation: TeamReservation; notes: string }) =>
      confirmReservationContact(reservation.id, notes),
    retry: false,
  });
  const resolution = useMutation({
    mutationFn: ({
      reservation,
      decision,
      notes,
    }: {
      reservation: TeamReservation;
      decision: ReservationDecision;
      notes: string;
    }) => resolveReservation(reservation.id, decision, notes),
    retry: false,
  });
  const busy = mutation.isPending || resolution.isPending;
  async function resolve(
    reservation: TeamReservation,
    decision: ReservationDecision,
    notes: string,
  ) {
    try {
      const saved = await resolution.mutateAsync({ reservation, decision, notes });
      cache.setQueryData<TeamReservation[]>(
        ["team-reservations", user?.id, search, filter, page],
        (rows) => rows?.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)),
      );
      setNotice(
        decision === "confirmed"
          ? `Reserva ${saved.id} confirmada. A área permanece indisponível.`
          : `Reserva ${saved.id} desativada. A área foi liberada.`,
      );
      void cache.invalidateQueries({ queryKey: ["team-reservations"] });
      void cache.invalidateQueries({ queryKey: ["area-reservations"] });
    } catch (failure) {
      void cache.invalidateQueries({ queryKey: ["team-reservations"] });
      throw failure;
    }
  }
  async function confirm(reservation: TeamReservation, notes: string) {
    try {
      const saved = await mutation.mutateAsync({ reservation, notes });
      cache.setQueryData<TeamReservation[]>(
        ["team-reservations", user?.id, search, filter, page],
        (rows) =>
          rows?.map((row) =>
            row.id === saved.id
              ? {
                  ...row,
                  ...saved,
                }
              : row,
          ),
      );
      setNotice(
        `Contato confirmado para o protocolo ${saved.id}. A reserva permanece ativa para negociação.`,
      );
      void cache.invalidateQueries({ queryKey: ["team-reservations"] });
      void cache.invalidateQueries({ queryKey: ["area-reservations"] });
    } catch (failure) {
      void cache.invalidateQueries({ queryKey: ["user-role"] });
      throw failure;
    }
  }
  function searchReservations(event: FormEvent<HTMLFormElement>) {
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
          <Headset size={16} /> Atendimento
        </p>
        <h1 className="font-display mt-6 text-5xl sm:text-7xl">Reservas e contatos</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Acompanhe as solicitações e registre os contatos recebidos dentro do prazo de cinco dias.
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
            <p>Entre com sua conta da equipe para acessar o atendimento.</p>
            <Button asChild>
              <Link to="/">Entrar</Link>
            </Button>
          </div>
        ) : !allowed ? (
          <div className="mt-10 space-y-4 border border-border bg-card p-6">
            <h2 className="text-xl">Acesso restrito à equipe</h2>
            <p>Esta área é exclusiva de colaboradores e administradores.</p>
            <Link to="/inicio" className="inline-block underline">
              Voltar ao site
            </Link>
          </div>
        ) : (
          <>
            <form
              onSubmit={searchReservations}
              className="mt-10 grid items-end gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-[1fr_auto] lg:grid-cols-[1fr_230px_auto]"
            >
              <div>
                <label htmlFor="team-search" className="text-sm font-semibold">
                  Buscar reserva
                </label>
                <input
                  id="team-search"
                  type="search"
                  maxLength={200}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="E-mail do cliente ou protocolo"
                  className="mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="team-filter" className="text-sm font-semibold">
                  Filtrar por situação
                </label>
                <select
                  id="team-filter"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as ReservationStatus | "all");
                    setPage(0);
                    setNotice("");
                  }}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todas as situações</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
                Carregando reservas...
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
                  <p className="text-sm text-muted-foreground">
                    {total} {total === 1 ? "reserva encontrada" : "reservas encontradas"}
                  </p>
                  <Button
                    variant="ghost"
                    disabled={listing.isFetching || busy}
                    onClick={() => {
                      void listing.refetch();
                    }}
                  >
                    Atualizar lista
                  </Button>
                </div>
                {!listing.data?.length ? (
                  <p className="mt-6 border border-dashed border-border p-8 text-center text-muted-foreground">
                    Nenhuma reserva encontrada. Tente outro e-mail, protocolo ou situação.
                  </p>
                ) : (
                  <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {listing.data.map((reservation) => (
                      <li
                        key={`${reservation.id}-${reservation.status}`}
                        className="min-w-0 rounded-lg border border-border bg-card p-6"
                      >
                        <p className="text-sm font-semibold text-primary">
                          {reservationStatus(reservation, now)}
                        </p>
                        <h2 className="mt-4 text-xl">
                          {LOTES.find((region) => region.id === reservation.region_id)?.nome ??
                            reservation.region_id}{" "}
                          · Parcela {reservation.parcel_id}
                        </h2>
                        <p className="mt-3 break-all text-sm font-semibold">
                          {reservation.client_email ?? "Cliente sem e-mail"}
                        </p>
                        <p className="mt-2 break-all text-xs text-muted-foreground">
                          Protocolo: {reservation.id}
                        </p>
                        <p className="mt-4 text-sm text-muted-foreground">
                          Solicitada: {formatDeadline(reservation.created_at)} (Brasília)
                        </p>
                        {(reservation.status === "pending_contact" ||
                          reservation.status === "expired") && (
                          <p className="mt-2 text-sm">
                            Prazo: {formatDeadline(reservation.expires_at)} (Brasília)
                          </p>
                        )}
                        {reservation.status === "pending_contact" &&
                        isReservationActive(reservation, now) ? (
                          <ContactForm reservation={reservation} busy={busy} onConfirm={confirm} />
                        ) : ["contacted", "confirmed", "deactivated", "cancelled"].includes(
                            reservation.status,
                          ) ? (
                          <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                            {reservation.status === "contacted" &&
                              negotiationDeadline(reservation) && (
                                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                                  <p className="font-semibold">
                                    Negociação até{" "}
                                    {formatDeadline(negotiationDeadline(reservation)!)} (Brasília)
                                  </p>
                                  <p>
                                    Prazo de 15 dias após o contato. Sem conclusão, a reserva é
                                    desativada e a área é liberada.
                                  </p>
                                </div>
                              )}
                            {reservation.status === "confirmed" && (
                              <p className="font-semibold">
                                Negociação concluída. A área permanece indisponível.
                              </p>
                            )}
                            {reservationStatus(reservation, now) === "Reserva desativada" && (
                              <p className="font-semibold">
                                Reserva desativada. A área está liberada para novas solicitações.
                              </p>
                            )}
                            {reservation.status === "cancelled" && (
                              <p className="font-semibold">
                                Reserva cancelada pelo cliente. A área foi liberada.
                              </p>
                            )}
                            {reservation.resolved_at && (
                              <p>
                                Encerrada em {formatDeadline(reservation.resolved_at)} (Brasília).
                              </p>
                            )}
                            {reservation.resolution_reason === "negotiation_timeout" && (
                              <p>Desativação automática: prazo de negociação encerrado.</p>
                            )}
                            {reservation.resolved_by_email && (
                              <p className="break-all">
                                Encerrada por: {reservation.resolved_by_email}
                              </p>
                            )}
                            {reservation.resolution_note && (
                              <p className="whitespace-pre-wrap break-words">
                                {reservation.resolution_note}
                              </p>
                            )}
                            {reservation.contacted_at && (
                              <p>
                                Contato confirmado em {formatDeadline(reservation.contacted_at)}{" "}
                                (Brasília).
                              </p>
                            )}
                            {reservation.confirmed_by_email && (
                              <p className="break-all">
                                Responsável: {reservation.confirmed_by_email}
                              </p>
                            )}
                            {reservation.contact_note && (
                              <div>
                                <p className="font-semibold">Observação interna</p>
                                <p className="mt-1 whitespace-pre-wrap break-words">
                                  {reservation.contact_note}
                                </p>
                              </div>
                            )}
                            {reservation.status === "contacted" &&
                              isReservationActive(reservation, now) && (
                                <ResolutionForm
                                  reservation={reservation}
                                  busy={busy}
                                  onResolve={resolve}
                                />
                              )}
                          </div>
                        ) : (
                          <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
                            O prazo venceu. Esta reserva não pode ser confirmada. O cliente pode
                            solicitar novamente se a área estiver disponível.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <nav
                  aria-label="Paginação de reservas"
                  className="mt-8 flex flex-wrap items-center justify-between gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={page === 0 || busy}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">Página {page + 1}</span>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * TEAM_PAGE_SIZE >= total || busy}
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
