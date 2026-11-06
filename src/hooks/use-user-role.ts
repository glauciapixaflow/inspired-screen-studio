import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import { getMyRole } from "@/lib/user-profiles";

export function useUserRole() {
  const auth = useAuthUser();
  const query = useQuery({
    queryKey: ["user-role", auth.user?.id],
    queryFn: getMyRole,
    enabled: !!auth.user,
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  // UI hints only: the database must authorize every privileged operation.
  // Never reuse another account's cached role, and never grant access on error.
  return {
    user: auth.user,
    role: auth.user && !query.isError ? (query.data ?? null) : null,
    loading: auth.loading || (!!auth.user && query.isPending),
    error: auth.error || query.isError,
  };
}
