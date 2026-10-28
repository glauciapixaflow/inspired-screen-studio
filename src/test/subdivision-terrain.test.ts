import { describe, expect, it } from "vitest";
import { terrainHeight } from "@/lib/subdivision-terrain";

describe("Subdivision surrounding relief", () => {
  it("shows raised relief outside the subdivision", () => {
    expect(terrainHeight(-18, -120)).toBeGreaterThan(20);
    expect(terrainHeight(-125, 5)).toBeGreaterThan(15);
  });
  it("keeps the plots, roads and walkway access flat and unobstructed", () => {
    for (const x of [-30, -22, 0, 22, 30]) for (const z of [-30, -22, 0, 22, 30]) {
      expect(terrainHeight(x, z)).toBe(0);
    }
  });
});