import { describe, expect, it } from "vitest";
import { LOTES } from "@/lib/mars-regions";
import { reserveConstructionSite } from "@/lib/construction";

describe("Expanded map areas", () => {
  it("adds selectable regions beyond the original three", () => {
    const added = LOTES.filter(region => !["Elysium", "Olympus", "Valles"].includes(region.nome));
    expect(added.length).toBeGreaterThan(0);
    for (const region of added) {
      expect(reserveConstructionSite(region.nome, "A1")).toEqual({ region: region.nome, parcel: "A1" });
    }
  });
  it("keeps region identifiers and map locations distinct", () => {
    expect(new Set(LOTES.map(region => region.id)).size).toBe(LOTES.length);
    expect(new Set(LOTES.map(region => `${region.lat},${region.lon}`)).size).toBe(LOTES.length);
  });
});