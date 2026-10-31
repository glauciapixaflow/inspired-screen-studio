export type CivicInterior = "library" | "leisure" | "sports";
type TourStop = { name: string; position: [number, number, number]; target: [number, number, number] };
export const INTERIOR_TOURS: Record<CivicInterior, { name: string; stops: TourStop[] }> = {
  library: { name: "Megabiblioteca", stops: [
    { name: "Átrio do conhecimento", position: [0, 2, 9], target: [0, 3, -2] },
    { name: "Acervo interplanetário", position: [-6, 2, -2], target: [-9, 2.5, -7] },
    { name: "Salão de leitura", position: [5, 2, 1], target: [8, 1.5, -5] },
  ] },
  leisure: { name: "Lazer Orbital", stops: [
    { name: "Jardim interno", position: [0, 2, 10], target: [-5, 1, 2] },
    { name: "Piscina orbital", position: [7, 2, 4], target: [0, 0.7, 0] },
    { name: "Lounge panorâmico", position: [-6, 2, -3], target: [-7, 1, -7] },
  ] },
  sports: { name: "Arena Solaris", stops: [
    { name: "Entrada da arena", position: [0, 2, 10], target: [0, 1, -4] },
    { name: "Quadra multiuso", position: [8, 2, 2], target: [0, 0.5, 0] },
    { name: "Galeria esportiva", position: [-7, 3, -5], target: [0, 1, 0] },
  ] },
};

export function nextTourStop(current: number, direction: number, count: number) {
  return ((current + direction) % count + count) % count;
}