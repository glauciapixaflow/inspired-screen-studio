import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cancelMyReservation } from "@/lib/reservation-cancellation";
import type { AreaReservation } from "@/lib/reservations";

export function CancelReservationButton({ reservation }: { reservation: AreaReservation }) {
  const cache = useQueryClient();
  const [review, setReview] = useState(false);
  const mutation = useMutation({
    mutationFn: () => cancelMyReservation(reservation.id),
    retry: false,
    onSuccess: async (saved) => {
      cache.setQueryData<AreaReservation[]>(["area-reservations", reservation.user_id], (rows) =>
        rows?.map((row) => (row.id === saved.id ? saved : row)),
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["area-reservations"] }),
        cache.invalidateQueries({ queryKey: ["team-reservations"] }),
      ]);
      setReview(false);
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ["area-reservations"] });
    },
  });
  return (
    <div className="space-y-3 border-t border-border pt-4">
      {review ? (
        <>
          <p className="text-sm">
            Cancelar a reserva da parcela {reservation.parcel_id}? A área será liberada para outras
            pessoas. O cancelamento não pode ser desfeito.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setReview(false);
                mutation.reset();
              }}
            >
              Manter reserva
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" onClick={() => setReview(true)}>
          Cancelar minha reserva
        </Button>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
