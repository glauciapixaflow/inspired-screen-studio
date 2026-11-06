import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import { cancelMyReservation } from "@/lib/reservation-cancellation";
beforeEach(() => vi.clearAllMocks());
describe("Cancellation API", () => {
  it("sends only the reservation ID, with no owner or timestamp override", async () => {
    const saved = { id: "reservation-a", status: "cancelled", resolved_at: "2026-11-05T13:00:00Z" };
    rpc.mockResolvedValue({ data: saved, error: null });
    await expect(cancelMyReservation("reservation-a")).resolves.toEqual(saved);
    expect(rpc).toHaveBeenCalledWith("cancel_my_reservation", {
      p_reservation_id: "reservation-a",
    });
  });
  it.each(["42501", "P0002", "P0001", "40001"])(
    "does not declare cancellation on server rejection %s",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { code } });
      await expect(cancelMyReservation("reservation-a")).rejects.toThrow();
    },
  );
  it("rejects an inconsistent success response", async () => {
    rpc.mockResolvedValue({ data: { id: "reservation-a", status: "contacted" }, error: null });
    await expect(cancelMyReservation("reservation-a")).rejects.toThrow("verificar");
  });
});
