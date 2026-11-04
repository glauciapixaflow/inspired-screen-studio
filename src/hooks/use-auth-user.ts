import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase")
      .then(({ supabase }) => {
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          setUser(session?.user ?? null);
          setLoading(false);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return { user, loading, error };
}
