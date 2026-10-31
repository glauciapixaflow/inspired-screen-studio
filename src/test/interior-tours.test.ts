import { describe, expect, it } from "vitest";
import { INTERIOR_TOURS, nextTourStop } from "@/lib/interior-tours";

describe("Civic interior tours", () => {
  it.each(["library", "leisure", "sports"] as const)("provides interior viewpoints for %s", id => {
    expect(INTERIOR_TOURS[id].stops.length).toBeGreaterThanOrEqual(3);
    for (const point of INTERIOR_TOURS[id].stops) {
      expect(Math.hypot(point.position[0], point.position[2])).toBeLessThan(14);
      expect(point.position[1]).toBeGreaterThan(0);
      expect(point.target).not.toEqual(point.position);
    }
  });
  it("cycles forward and backward through all tour stops", () => {
    expect(nextTourStop(2, 1, 3)).toBe(0);
    expect(nextTourStop(0, -1, 3)).toBe(2);
    expect(nextTourStop(0, 1, 3)).toBe(1);
  });
});