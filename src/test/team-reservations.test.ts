import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import {
  confirmReservationContact,
  listTeamReservations,
  resolveReservation,
} from "@/lib/team-reservations";
const confirmed = {
  id: "reservation-a",
  status: "contacted",
  contacted_at: "2026-11-05T12:00:00Z",
};
beforeEach(() => vi.clearAllMocks());
describe("Team reservation API", () => {
  it("passes search, status and pagination to the protected listing", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(listTeamReservations(" teste ", "expired", 1)).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith("team_list_reservations", {
      p_search: "teste",
      p_status: "expired",
      p_limit: 20,
      p_offset: 20,
    });
  });
  it("reports listing denial", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(listTeamReservations("", null, 0)).rejects.toThrow("não permite consultar");
  });
  it("sends only protocol and notes, never the confirmer's identity", async () => {
    rpc.mockResolvedValue({ data: confirmed, error: null });
    await expect(
      confirmReservationContact("reservation-a", "  Falei com o cliente.  "),
    ).resolves.toEqual(confirmed);
    expect(rpc).toHaveBeenCalledWith("confirm_reservation_contact", {
      p_reservation_id: "reservation-a",
      p_notes: "Falei com o cliente.",
    });
  });
  it.each([
    ["42501", "Somente a equipe"],
    ["P0001", "prazo desta reserva venceu"],
    ["P0002", "não encontrada"],
  ])("handles backend rejection %s", async (code, message) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(confirmReservationContact("reservation-a", "")).rejects.toThrow(message);
  });
  it("rejects oversized notes before calling the backend", async () => {
    await expect(confirmReservationContact("reservation-a", "x".repeat(2001))).rejects.toThrow(
      "2000",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not claim success for an unexpected reservation or missing timestamp", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ...confirmed, id: "other" }, error: null })
      .mockResolvedValueOnce({ data: { ...confirmed, contacted_at: null }, error: null });
    await expect(confirmReservationContact("reservation-a", "")).rejects.toThrow("verificar");
    await expect(confirmReservationContact("reservation-a", "")).rejects.toThrow("verificar");
  });
});

describe("Negotiation decision API", () => {
  it("submits the decision and notes without a caller-supplied actor or timestamp", async () => {
    const result = {
      id: "reservation-a",
      status: "confirmed",
      resolved_at: "2026-11-05T13:00:00Z",
    };
    rpc.mockResolvedValue({ data: result, error: null });
    await expect(
      resolveReservation("reservation-a", "confirmed", " Acordo concluído. "),
    ).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith("resolve_reservation", {
      p_reservation_id: "reservation-a",
      p_decision: "confirmed",
      p_notes: "Acordo concluído.",
    });
  });
  it.each(["42501", "P0001", "40001"])("rejects a denied or stale resolution: %s", async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(resolveReservation("reservation-a", "confirmed", "")).rejects.toThrow();
  });
  it("does not claim success when the returned decision differs", async () => {
    rpc.mockResolvedValue({
      data: { id: "reservation-a", status: "deactivated", resolved_at: "2026-11-05T13:00:00Z" },
      error: null,
    });
    await expect(resolveReservation("reservation-a", "confirmed", "")).rejects.toThrow("verificar");
  });
});
