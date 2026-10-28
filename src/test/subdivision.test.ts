import { describe, expect, it } from "vitest";
import { SUBDIVISION_PARCELS, subdivisionHomes } from "@/lib/subdivision";

describe("Post-print subdivision", () => {
  it("places the completed house on the exact reserved parcel in its own region", () => {
    const homes = [{ region: "Olympus", parcel: "C2" }, { region: "Valles", parcel: "A1" }];
    expect(subdivisionHomes("Olympus", homes)).toEqual([{ id: "C2", x: -5.5, z: -5.5 }]);
    expect(subdivisionHomes("Elysium", homes)).toEqual([]);
  });
  it("keeps all sixteen map parcels available in the local view", () => {
    expect(SUBDIVISION_PARCELS.map(parcel => parcel.id)).toEqual(["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"]);
  });
});