import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import { listReservations } from "@/lib/reservations";

export function useReservations() {
  const auth = useAuthUser();
  const query = useQuery({
    queryKey: ["area-reservations", auth.user?.id],
    queryFn: () => listReservations(auth.user!.id),
    enabled: !!auth.user,
    retry: false,
    refetchInterval: 30_000,
  });
  return { ...auth, query };
}
