import { describe, expect, it } from "vitest";
import { reserveConstructionSite, completeConstruction, parcelOffset, printProgress } from "@/lib/construction";
import { habitatPlacement, HABITAT_SCALE } from "@/lib/subdivision";

describe("Reservation to house printing", () => {
  it("uses the same on-parcel position and scale for printing and the finished habitat", () => {
    expect(habitatPlacement("C2")).toEqual([-5.5, 0.12, -6.1]);
    expect(habitatPlacement("A4")).toEqual([16.5, 0.12, 15.9]);
    expect(habitatPlacement("Z9")).toBeNull();
    expect(HABITAT_SCALE).toBe(0.85);
  });
  it("completes the accelerated visual animation in 24 seconds without completing early", () => {
    expect(printProgress(12)).toBe(0.5);
    expect(printProgress(23.9)).toBeLessThan(1);
    expect(printProgress(24)).toBe(1);
    expect(printProgress(40)).toBe(1);
  });
  it("opens construction for the exact region and parcel reserved by the client", () => {
    expect(reserveConstructionSite("Olympus", "C2")).toEqual({ region: "Olympus", parcel: "C2" });
  });
  it("does not start construction without a chosen parcel", () => {
    expect(reserveConstructionSite("Olympus", null)).toBeNull();
  });
  it("shows a completed house only on the exact reserved parcel after printing finishes", () => {
    const site = { region: "Olympus", parcel: "C2" };
    expect(completeConstruction([], site, 0.99)).toEqual([]);
    expect(completeConstruction([], site, 1)).toEqual([{ region: "Olympus", parcel: "C2" }]);
    expect(parcelOffset("C2")).toEqual([-0.0161, 0.0161]);
  });
  it("does not duplicate a house when it is reprinted", () => {
    const sites = [{ region: "Olympus", parcel: "C2" }];
    expect(completeConstruction(sites, sites[0] ?? {region: "", parcel: ""}, 1)).toEqual(sites);
  });
});