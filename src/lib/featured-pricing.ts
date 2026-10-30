// Illustrative offers authorized by the user, comparable to the original featured lots.
export const FEATURED_PRICING = {
  arcadia: { areaM2: 2800, priceBRL: 219000 },
  utopia: { areaM2: 3600, priceBRL: 269000 },
  isidis: { areaM2: 4200, priceBRL: 298000 },
} as const;

export function featuredOffer(key: keyof typeof FEATURED_PRICING) {
  const offer = FEATURED_PRICING[key];
  return {
    area: `${offer.areaM2.toLocaleString("pt-BR")} m²`,
    preco: `R$ ${offer.priceBRL / 1000} mil`,
  };
}