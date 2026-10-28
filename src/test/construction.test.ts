import { describe, expect, it } from "vitest";
import { reserveConstructionSite, completeConstruction, parcelOffset } from "@/lib/construction";

describe("Reservation to house printing", () => {
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