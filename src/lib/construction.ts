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