import type { ConstructionSite } from "@/lib/construction";

export const SUBDIVISION_PARCELS = ["A", "B", "C", "D"].flatMap((row, i) =>
  [1, 2, 3, 4].map((column, j) => ({ id: `${row}${column}`, x: (j - 1.5) * 11, z: (1.5 - i) * 11 })),
);

export const HABITAT_SCALE = 0.85;
export function habitatPlacement(parcel: string): [number, number, number] | null {
  const plot = SUBDIVISION_PARCELS.find(plot => plot.id === parcel);
  return plot ? [plot.x, 0.12, plot.z - 0.6] : null;
}

export function subdivisionHomes(region: string, homes: ConstructionSite[]) {
  return SUBDIVISION_PARCELS.filter(parcel => homes.some(home => home.region === region && home.parcel === parcel.id));
}