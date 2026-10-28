import { describe, expect, it } from "vitest";
import { CIVIC_DESTINATIONS, NEIGHBORING_SUBDIVISIONS } from "@/lib/neighborhood";
import { SUBDIVISION_PARCELS } from "@/lib/subdivision";
import { terrainHeight } from "@/lib/subdivision-terrain";

describe("Nearby Martian community", () => {
  it("places multiple distinct subdivisions close to the original without overlapping its parcels", () => {
    expect(NEIGHBORING_SUBDIVISIONS.length).toBeGreaterThanOrEqual(2);
    for (const area of NEIGHBORING_SUBDIVISIONS) {
      expect(Math.hypot(area.x, area.z)).toBeLessThan(90);
      expect(Math.abs(area.x)).toBeGreaterThan(47);
      for (const parcel of SUBDIVISION_PARCELS) expect(terrainHeight(area.x + parcel.x, area.z + parcel.z)).toBe(0);
    }
  });
  it("keeps the mega library near the homes and clear of terrain", () => {
    const library = CIVIC_DESTINATIONS.find(place => place.id === "library");
    expect(library).toBeDefined();
    if (!library) return;
    expect(Math.hypot(library.x, library.z)).toBeLessThan(100);
    expect(terrainHeight(library.x, library.z)).toBe(0);
    expect(terrainHeight(library.x + 15, library.z)).toBe(0);
  });
  it("provides multiple nearby leisure centers on unobstructed ground", () => {
    const centers = CIVIC_DESTINATIONS.filter(place => place.id !== "library");
    expect(centers.length).toBeGreaterThanOrEqual(2);
    for (const center of centers) {
      expect(Math.hypot(center.x, center.z)).toBeLessThan(100);
      expect(terrainHeight(center.x, center.z)).toBe(0);
    }
  });
});