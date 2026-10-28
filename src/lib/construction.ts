export type ConstructionSite = { region: string; parcel: string };

export function reserveConstructionSite(region: string, parcel: string | null): ConstructionSite | null {
  if (!region || !parcel) return null;
  return { region, parcel };
}

export function constructionStage(progress: number) {
  if (progress >= 1) return "Casa concluída";
  if (progress >= 0.88) return "Imprimindo cobertura";
  if (progress > 0.06) return "Imprimindo paredes";
  return "Preparando fundação";
}

export function completeConstruction(sites: ConstructionSite[], site: ConstructionSite, progress: number) {
  if (progress < 1 || sites.some(existing => existing.region === site.region && existing.parcel === site.parcel)) return sites;
  return [...sites, { ...site }];
}

export function parcelOffset(parcel: string): [number, number] {
  const row = ["A", "B", "C", "D"].indexOf(parcel.charAt(0));
  const column = Number(parcel.charAt(1)) - 1;
  return [(column - 1.5) * 0.028 * 1.15, (row - 1.5) * 0.028 * 1.15];
}