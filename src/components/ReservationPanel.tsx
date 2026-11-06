import type { ParcelAvailability } from "@/lib/parcel-availability";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useReservations } from "@/hooks/use-reservations";
import { useReservationClock } from "@/hooks/use-reservation-clock";
import {
  formatDeadline,
  isReservationActive,
  reservationStatus,
  reserveArea,
  negotiationDeadline,
} from "@/lib/reservations";

export function ReservationPanel({
  regionId,
  parcelId,
  occupied,
  availabilityPending = false,
  availabilityError = false,
}: {
  regionId: string;
  parcelId: string;
  occupied?: ParcelAvailability | undefined;
  availabilityPending?: boolean;
  availabilityError?: boolean;
}) {
  const { user, loading, error, query } = useReservations();
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => reserveArea(regionId, parcelId),
    retry: false,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["area-reservations"] });
    },
  });
  const now = useReservationClock(
    (query.data ?? [])
      .flatMap((row) => [
        row.expires_at,
        ...(negotiationDeadline(row) ? [negotiationDeadline(row)!] : []),
      ])
      .concat(
        mutation.data
          ? [
              mutation.data.expires_at,
              ...(negotiationDeadline(mutation.data) ? [negotiationDeadline(mutation.data)!] : []),
            ]
          : [],
      ),
  );
  const latestMutation = query.data?.find((row) => row.id === mutation.data?.id) ?? mutation.data;
  const saved = user
    ? (query.data?.find(
        (row) =>
          row.region_id === regionId && row.parcel_id === parcelId && isReservationActive(row, now),
      ) ??
      (latestMutation?.user_id === user.id && isReservationActive(latestMutation, now)
        ? latestMutation
        : undefined))
    : undefined;

  if (loading)
    return (
      <p role="status" className="mt-4 text-sm">
        Verificando sua conta...
      </p>
    );
  if (error)
    return (
      <p role="alert" className="mt-4 text-sm text-destructive">
        Não foi possível verificar sua conta. Recarregue a página.
      </p>
    );
  if (!user)
    return (
      <div className="mt-4 space-y-3 text-sm">
        <p>Entre na sua conta para reservar esta área e negociar com a equipe.</p>
        <Button asChild className="w-full">
          <Link to="/">Entrar para reservar</Link>
        </Button>
      </div>
    );

  return (
    <div className="mt-4 space-y-3 text-sm">
      {saved ? (
        <div role="status" className="space-y-2">
          <p className="font-semibold text-primary">Solicitação de reserva salva</p>
          <p>
            {reservationStatus(saved, now)}
            {saved.status !== "confirmed" && " · sujeita à conclusão da equipe."}
          </p>
          {saved.status === "contacted" && negotiationDeadline(saved) && (
            <p>
              Negociação até {formatDeadline(negotiationDeadline(saved)!)} (Brasília). Sem conclusão
              em 15 dias, a reserva é desativada.
            </p>
          )}
          {saved.status === "pending_contact" && (
            <p>
              Entre em contato até{" "}
              <strong>{formatDeadline(saved.expires_at)} (horário de Brasília)</strong>. Sem contato
              confirmado pela equipe, a reserva expira e a parcela é liberada.
            </p>
          )}
          <p className="break-all">
            Protocolo: <span className="font-mono">{saved.id}</span>
          </p>
          <p>Guarde o protocolo para informar à equipe ao negociar.</p>
          <Link to="/inicio" hash="minhas-reservas" className="block underline">
            Ver minhas reservas
          </Link>
        </div>
      ) : (
        <>
          {occupied ? (
            <p role="status" className="font-semibold text-primary">
              {occupied.status === "confirmed"
                ? "Esta área já foi confirmada e está indisponível."
                : "Esta área já está reservada por outra conta."}{" "}
              Escolha outra parcela.
            </p>
          ) : availabilityError ? (
            <p role="alert">
              Não foi possível verificar a disponibilidade. Atualize o mapa antes de reservar.
            </p>
          ) : availabilityPending ? (
            <p role="status">Consultando disponibilidade...</p>
          ) : null}
          <p>
            A reserva registra seu interesse para negociação posterior. Não confirma compra nem
            propriedade. Você tem cinco dias corridos (120 horas) para entrar em contato; sem
            confirmação da equipe, a reserva expira automaticamente.
          </p>
          {mutation.isError && (
            <p role="alert" className="text-destructive">
              {mutation.error.message}
            </p>
          )}
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              query.isPending ||
              !!occupied ||
              availabilityPending ||
              availabilityError
            }
            className="h-auto w-full py-3"
          >
            {mutation.isPending
              ? "Salvando reserva..."
              : query.isPending
                ? "Verificando reservas..."
                : "Solicitar reserva desta área"}
          </Button>
        </>
      )}
    </div>
  );
}
