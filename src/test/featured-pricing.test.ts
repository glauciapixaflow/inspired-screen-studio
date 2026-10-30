import { describe, expect, it } from "vitest";
import { FEATURED_PRICING } from "@/lib/featured-pricing";

describe("Illustrative featured offers", () => {
  it("bases the new areas on the original featured area range", () => {
    for (const offer of Object.values(FEATURED_PRICING)) {
      expect(offer.areaM2).toBeGreaterThanOrEqual(2400);
      expect(offer.areaM2).toBeLessThanOrEqual(4850);
    }
  });
  it("keeps prices and price per square meter within the original offers' range", () => {
    for (const offer of Object.values(FEATURED_PRICING)) {
      expect(offer.priceBRL).toBeGreaterThanOrEqual(189000);
      expect(offer.priceBRL).toBeLessThanOrEqual(312000);
      expect(offer.priceBRL / offer.areaM2).toBeGreaterThanOrEqual(312000 / 4850);
      expect(offer.priceBRL / offer.areaM2).toBeLessThanOrEqual(247000 / 3100);
    }
  });
});