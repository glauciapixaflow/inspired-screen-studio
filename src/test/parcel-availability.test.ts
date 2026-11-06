import { describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import {
  activeParcelAvailability,
  listParcelAvailability,
  type ParcelAvailability,
} from "@/lib/parcel-availability";
describe("Parcel availability", () => {
  it("releases timed holds at the exact cutoff but keeps confirmed parcels", () => {
    const rows: ParcelAvailability[] = [
      {
        region_id: "08",
        parcel_id: "A1",
        status: "reserved",
        available_until: "2026-11-05T12:00:00Z",
      },
      { region_id: "08", parcel_id: "A2", status: "confirmed", available_until: null },
    ];
    expect(activeParcelAvailability(rows, Date.parse("2026-11-05T11:59:59Z"))).toHaveLength(2);
    expect(activeParcelAvailability(rows, Date.parse("2026-11-05T12:00:00Z"))).toEqual([rows[1]]);
  });
  it("only uses the limited availability endpoint and discards extraneous fields", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          region_id: "08",
          parcel_id: "A1",
          status: "confirmed",
          available_until: null,
          email: "private@example.invalid",
        },
      ],
      error: null,
    });
    const rows = await listParcelAvailability();
    expect(rpc).toHaveBeenCalledWith("map_area_availability");
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "available_until",
      "parcel_id",
      "region_id",
      "status",
    ]);
  });
  it("reports unavailable lookup instead of showing an empty free map", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(listParcelAvailability()).rejects.toThrow("Não foi possível consultar");
  });
});
