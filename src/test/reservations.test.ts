import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUser, from } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getUser }, from } }));
import { listReservations, reserveArea } from "@/lib/reservations";

const reservation = {
  id: "protocol-a",
  user_id: "user-a",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-04T12:00:00Z",
  expires_at: "2026-11-09T12:00:00Z",
  contacted_at: null,
};
function builder(result: unknown) {
  const chain = {
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    returns: vi.fn().mockResolvedValue(result),
  };
  for (const method of [chain.insert, chain.select, chain.eq, chain.in, chain.order])
    method.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
});
describe("Area reservation persistence", () => {
  it("rejects visitors before writing", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(reserveArea("08", "A1")).rejects.toThrow("Entre na sua conta");
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects invalid regions and parcels", async () => {
    await expect(reserveArea("99", "A1")).rejects.toThrow("válidas");
    await expect(reserveArea("08", "A5")).rejects.toThrow("válidas");
    expect(from).not.toHaveBeenCalled();
  });
  it("saves only region and parcel, leaving ownership to the database", async () => {
    const query = builder({ data: reservation, error: null });
    from.mockReturnValue(query);
    await expect(reserveArea("08", "A1")).resolves.toEqual(reservation);
    expect(query.insert).toHaveBeenCalledWith({ region_id: "08", parcel_id: "A1" });
  });
  it("returns the same protocol when the owner retries", async () => {
    const duplicate = builder({ data: null, error: { code: "23505" } });
    const own = builder({ data: reservation, error: null });
    from.mockReturnValueOnce(duplicate).mockReturnValueOnce(own);
    await expect(reserveArea("08", "A1")).resolves.toEqual(reservation);
    expect(own.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(own.in).toHaveBeenCalledWith("status", ["pending_contact", "contacted", "confirmed"]);
  });
  it("reports another user's reserved parcel without leaking their record", async () => {
    from
      .mockReturnValueOnce(builder({ data: null, error: { code: "23505" } }))
      .mockReturnValueOnce(builder({ data: null, error: null }));
    await expect(reserveArea("08", "A1")).rejects.toThrow("Escolha outra área");
  });
  it("does not report success when persistence fails", async () => {
    from.mockReturnValue(builder({ data: null, error: { code: "42501" } }));
    await expect(reserveArea("08", "A1")).rejects.toThrow("Não foi possível salvar");
  });
  it("lists only the current user's reservations", async () => {
    const query = builder({ data: [reservation], error: null });
    from.mockReturnValue(query);
    await expect(listReservations("user-a")).resolves.toEqual([reservation]);
    expect(from).toHaveBeenCalledWith("area_reservation_details");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a");
  });
});
