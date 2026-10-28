import { describe, expect, it } from "vitest";
import { reserveConstructionSite } from "@/lib/construction";

describe("Reservation to house printing", () => {
  it("opens construction for the exact region and parcel reserved by the client", () => {
    expect(reserveConstructionSite("Olympus", "C2")).toEqual({ region: "Olympus", parcel: "C2" });
  });
  it("does not start construction without a chosen parcel", () => {
    expect(reserveConstructionSite("Olympus", null)).toBeNull();
  });
});