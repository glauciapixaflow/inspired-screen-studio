import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { cancel } = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock("@/lib/reservation-cancellation", () => ({ cancelMyReservation: cancel }));
import { CancelReservationButton } from "@/components/CancelReservationButton";
import type { AreaReservation } from "@/lib/reservations";
const row: AreaReservation = {
  id: "reservation-a",
  user_id: "client-a",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-05T12:00:00Z",
  expires_at: "2026-11-10T12:00:00Z",
  contacted_at: null,
};
function show() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(["area-reservations", row.user_id], [row]);
  render(
    <QueryClientProvider client={cache}>
      <CancelReservationButton reservation={row} />
    </QueryClientProvider>,
  );
  return cache;
}
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe("Client cancellation confirmation", () => {
  it("requires review and lets the client keep the reservation", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar minha reserva" }));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByText(/A área será liberada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manter reserva" }));
    expect(
      screen.queryByRole("button", { name: "Confirmar cancelamento" }),
    ).not.toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
  });
  it("updates history only after the server acknowledges cancellation", async () => {
    let finish!: (value: AreaReservation) => void;
    cancel.mockReturnValue(
      new Promise<AreaReservation>((resolve) => {
        finish = resolve;
      }),
    );
    const cache = show();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar minha reserva" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(row.id));
    expect(screen.getByRole("button", { name: "Cancelando..." })).toBeDisabled();
    expect(cache.getQueryData(["area-reservations", row.user_id])).toEqual([row]);
    const saved = { ...row, status: "cancelled" as const, resolved_at: "2026-11-05T13:00:00Z" };
    finish(saved);
    await waitFor(() =>
      expect(cache.getQueryData(["area-reservations", row.user_id])).toEqual([saved]),
    );
  });
  it("keeps the reservation on a server error", async () => {
    cancel.mockRejectedValue(new Error("Não foi possível cancelar."));
    const cache = show();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar minha reserva" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível cancelar");
    expect(cache.getQueryData(["area-reservations", row.user_id])).toEqual([row]);
  });
});
