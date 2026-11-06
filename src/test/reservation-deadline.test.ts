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

describe("Fifteen day negotiation", () => {
  const contacted: AreaReservation = {
    ...reservation,
    status: "contacted",
    contacted_at: "2026-11-05T12:00:00Z",
    negotiation_expires_at: "2026-11-20T12:00:00Z",
  };
  const cutoff = Date.parse(contacted.negotiation_expires_at!);
  it("deactivates exactly at 360 hours after contact, rather than at the first-contact deadline", () => {
    expect(isReservationActive(contacted, cutoff - 1)).toBe(true);
    expect(isReservationActive(contacted, cutoff)).toBe(false);
    expect(reservationStatus(contacted, cutoff)).toBe("Reserva desativada");
  });
  it("keeps definitively confirmed areas unavailable after any deadline", () => {
    expect(isReservationActive({ ...contacted, status: "confirmed" }, cutoff + 100000000)).toBe(
      true,
    );
    expect(reservationStatus({ ...contacted, status: "confirmed" }, cutoff + 100000000)).toBe(
      "Reserva confirmada",
    );
  });
  it("does not keep a manually deactivated reservation active", () => {
    expect(isReservationActive({ ...contacted, status: "deactivated" }, cutoff - 100000)).toBe(
      false,
    );
  });
});
