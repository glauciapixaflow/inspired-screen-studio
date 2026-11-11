import { CancelReservationButton } from "@/components/CancelReservationButton";
import { Link } from "@tanstack/react-router";
import { useReservations } from "@/hooks/use-reservations";
import { useReservationClock } from "@/hooks/use-reservation-clock";
import {
  formatDeadline,
  negotiationDeadline,
  reservationStatus,
  isReservationActive,
} from "@/lib/reservations";
import { LOTES } from "@/lib/mars-regions";
import { Button } from "@/components/ui/button";

export function MyReservations() {
  const { user, loading, error, query } = useReservations();
  const now = useReservationClock(
    (query.data ?? []).flatMap((row) => [
      row.expires_at,
      ...(negotiationDeadline(row) ? [negotiationDeadline(row)!] : []),
    ]),
  );
  return (
    <section
      id="minhas-reservas"
      className="scroll-mt-6 border-t border-border px-6 py-16 lg:px-10"
    >
      <h2 className="font-display text-4xl sm:text-5xl">Minhas reservas</h2>
      <p className="mt-4 text-muted-foreground">
        Acompanhe as áreas selecionadas para negociar com os colaboradores do site. As solicitações
        estão sujeitas à confirmação da equipe.
      </p>
      {loading ? (
        <p role="status" className="mt-6">
          Verificando sua conta...
        </p>
      ) : error ? (
        <p role="alert" className="mt-6">
          Não foi possível verificar sua conta. Recarregue a página.
        </p>
      ) : !user ? (
        <p className="mt-6">
          <Link to="/" className="underline">
            Entre na sua conta
          </Link>{" "}
          para reservar uma área e acompanhar suas solicitações.
        </p>
      ) : query.isPending ? (
        <p role="status" className="mt-6">
          Carregando reservas...
        </p>
      ) : query.isError ? (
        <div className="mt-6">
          <p role="alert">{query.error.message}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              void query.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : !query.data?.length ? (
        <p className="mt-6">
          Você ainda não tem reservas.{" "}
          <Link to="/mapa" className="underline">
            Escolha uma área no mapa.
          </Link>
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((reservation) => (
            <li key={reservation.id} className="space-y-3 border border-border bg-card p-6">
              <h3 className="text-xl">
                {LOTES.find((region) => region.id === reservation.region_id)?.nome ??
                  reservation.region_id}{" "}
                · Parcela {reservation.parcel_id}
              </h3>
              <p className="text-sm font-semibold text-primary">
                {reservationStatus(reservation, now)}
              </p>
              {(reservation.status === "pending_contact" || reservation.status === "expired") && (
                <p className="text-sm">
                  Prazo para contato: {formatDeadline(reservation.expires_at)} (Brasília). Sem
                  contato confirmado em cinco dias, a parcela é liberada.
                </p>
              )}
              {reservationStatus(reservation, now) === "Reserva expirada" && (
                <p className="text-sm">
                  O prazo venceu. Você pode solicitar novamente se a área estiver disponível.
                </p>
              )}
              <p className="text-sm">
                Solicitada em{" "}
                {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
                  new Date(reservation.created_at),
                )}
              </p>
              <p className="break-all text-sm">
                Protocolo: <span className="font-mono">{reservation.id}</span>
              </p>
              {reservation.status === "contacted" && negotiationDeadline(reservation) && (
                <p className="text-sm">
                  Prazo de negociação: {formatDeadline(negotiationDeadline(reservation)!)}{" "}
                  (Brasília). Sem conclusão da equipe em 15 dias, a reserva é desativada.
                </p>
              )}
              {reservation.status === "cancelled" && (
                <p role="status" className="text-sm">
                  Cancelamento registrado
                  {reservation.resolved_at
                    ? ` em ${formatDeadline(reservation.resolved_at)} (Brasília)`
                    : ""}
                  . A área foi liberada para novas reservas.
                </p>
              )}
              {reservation.status === "confirmed" && (
                <p className="text-sm">
                  Negociação concluída pela equipe. A área permanece indisponível para novas
                  reservas.
                </p>
              )}
              {reservationStatus(reservation, now) === "Reserva desativada" && (
                <p className="text-sm">
                  Esta reserva foi desativada. Você pode solicitar novamente se a área estiver
                  disponível.
                </p>
              )}
              {(reservation.status === "pending_contact" || reservation.status === "contacted") &&
                isReservationActive(reservation, now) && (
                  <CancelReservationButton
                    key={`${reservation.id}-${reservation.status}`}
                    reservation={reservation}
                  />
                )}
              <p className="text-sm text-muted-foreground">
                Informe este protocolo ao conversar com a equipe sobre a área.
              </p>
              <Link
                to="/chat"
                search={{ reservation: reservation.id }}
                className="block font-semibold text-primary underline underline-offset-4"
              >
                Conversar sobre esta reserva
              </Link>
              <Link
                to="/mapa"
                search={{ region: reservation.region_id }}
                className="inline-block underline"
              >
                Ver região no mapa
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
