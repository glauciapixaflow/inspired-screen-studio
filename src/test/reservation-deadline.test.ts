import { describe, expect, it } from "vitest";
import { isReservationActive, reservationStatus, type AreaReservation } from "@/lib/reservations";

const reservation: AreaReservation = {
  id: "test",
  user_id: "user-a",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-04T12:00:00Z",
  expires_at: "2026-11-09T12:00:00Z",
  contacted_at: null,
};
const deadline = Date.parse(reservation.expires_at);
describe("Five day reservation deadline", () => {
  it("is active immediately before 120 hours and expired at the exact cutoff", () => {
    expect(deadline - Date.parse(reservation.created_at)).toBe(120 * 60 * 60 * 1000);
    expect(isReservationActive(reservation, deadline - 1)).toBe(true);
    expect(isReservationActive(reservation, deadline)).toBe(false);
    expect(reservationStatus(reservation, deadline)).toBe("Reserva expirada");
  });
  it("does not expire a reservation with contact confirmed by the team", () => {
    const contacted: AreaReservation = {
      ...reservation,
      status: "contacted",
      contacted_at: "2026-11-05T12:00:00Z",
    };
    expect(isReservationActive(contacted, deadline + 100000)).toBe(true);
    expect(reservationStatus(contacted, deadline + 100000)).toBe("Contato confirmado");
  });
  it("never treats an explicitly expired reservation as active", () => {
    expect(isReservationActive({ ...reservation, status: "expired" }, deadline - 1000)).toBe(false);
  });
});
