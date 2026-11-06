import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReservationClock } from "@/hooks/use-reservation-clock";
import { activeParcelAvailability, listParcelAvailability } from "@/lib/parcel-availability";

export function useParcelAvailability() {
  const auth = useAuthUser();
  const query = useQuery({
    queryKey: ["area-reservations", auth.user?.id, "availability"],
    queryFn: listParcelAvailability,
    enabled: !!auth.user && !auth.loading && !auth.error,
    retry: false,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });
  const now = useReservationClock(
    (query.data ?? []).flatMap((row) => (row.available_until ? [row.available_until] : [])),
  );
  return {
    ...auth,
    query,
    parcels: auth.user ? activeParcelAvailability(query.data ?? [], now) : [],
  };
}
