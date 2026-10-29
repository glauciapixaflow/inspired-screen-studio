// Local illustrative development; these are not additional saved reservations.
export const NEIGHBORING_SUBDIVISIONS = [
  { id: "aurora", name: "Loteamento Aurora", x: -62, z: 0 },
  { id: "horizonte", name: "Loteamento Horizonte", x: 62, z: 0 },
] as const;

export const CIVIC_DESTINATIONS = [
  { id: "library", name: "Megabiblioteca", x: 0, z: -65, radius: 23 },
  { id: "leisure", name: "Centro de laser Orbital", x: -50, z: -62, radius: 17 },
  { id: "sports", name: "Arena esportiva Solaris", x: 50, z: -62, radius: 17 },
] as const;

export type NeighborhoodDestination = "overview" | "home" | "top" | "aurora" | "horizonte" | "library" | "leisure" | "sports";

export function urbanClearance(x: number, z: number) {
  const distances = [Math.max(Math.abs(x), Math.abs(z)) - 30];
  for (const area of NEIGHBORING_SUBDIVISIONS) distances.push(Math.max(Math.abs(x - area.x), Math.abs(z - area.z)) - 29);
  for (const place of CIVIC_DESTINATIONS) distances.push(Math.hypot(x - place.x, z - place.z) - place.radius);
  // Continuous pedestrian corridors between the three subdivisions and civic plaza.
  distances.push(Math.max(Math.abs(x) - 92, Math.abs(z) - 4));
  distances.push(Math.max(Math.abs(x) - 4, Math.abs(z + 32) - 34));
  distances.push(Math.max(Math.abs(x) - 68, Math.abs(z + 62) - 4));
  return Math.min(...distances);
}