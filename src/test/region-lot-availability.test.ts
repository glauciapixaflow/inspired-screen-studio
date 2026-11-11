import { describe, expect, it } from "vitest";
import { regionLotAvailability, type ParcelAvailability } from "@/lib/parcel-availability";
import { REGION_LOT_IDS } from "@/lib/mars-regions";

describe("Land lot counts by region", () => {
  it("counts only unique lots belonging to the region grid", () => {
    const rows: ParcelAvailability[] = [
      { region_id: "08", parcel_id: "A1", status: "reserved", available_until: null },
      { region_id: "08", parcel_id: "A1", status: "reserved", available_until: null },
      { region_id: "08", parcel_id: "A2", status: "confirmed", available_until: null },
      { region_id: "08", parcel_id: "Z9", status: "confirmed", available_until: null },
      { region_id: "12", parcel_id: "A3", status: "confirmed", available_until: null },
    ];
    expect(regionLotAvailability("08", rows)).toEqual({
      total: 16,
      available: 14,
      reserved: 1,
      confirmed: 1,
    });
    expect(regionLotAvailability("12", rows).available).toBe(15);
  });
  it("shows zero available when every lot is confirmed", () => {
    const rows: ParcelAvailability[] = REGION_LOT_IDS.map((parcel_id) => ({
      region_id: "08",
      parcel_id,
      status: "confirmed",
      available_until: null,
    }));
    expect(regionLotAvailability("08", rows)).toEqual({
      total: 16,
      available: 0,
      reserved: 0,
      confirmed: 16,
    });
  });
});
