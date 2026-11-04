import { useEffect, useState } from "react";

// Refreshes deadline presentation at the exact boundary, also after tab sleep.
// Actual availability is enforced independently by the database clock.
export function useReservationClock(deadlines: string[]) {
  const [now, setNow] = useState(() => Date.now());
  const next = deadlines
    .map(Date.parse)
    .filter((deadline) => deadline > now)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timeout =
      next === undefined
        ? undefined
        : window.setTimeout(refresh, Math.min(Math.max(1, next - Date.now()), 2147483647));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [next, now]);
  return now;
}
