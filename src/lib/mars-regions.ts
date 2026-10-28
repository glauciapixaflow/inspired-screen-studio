export type Lote = { id: string; nome: string; lat: number; lon: number; preco: string | null };

export const LOTES: Lote[] = [
  { id: "08", nome: "Elysium", lat: 18.6, lon: 146, preco: "R$ 189 mil" },
  { id: "12", nome: "Olympus", lat: 18.4, lon: -134, preco: "R$ 312 mil" },
  { id: "21", nome: "Valles", lat: -12, lon: -70, preco: "R$ 247 mil" },
  { id: "27", nome: "Arcadia", lat: 46, lon: -170, preco: null },
  { id: "32", nome: "Utopia", lat: 46.7, lon: 117.5, preco: null },
  { id: "36", nome: "Isidis", lat: 12.9, lon: 87, preco: null },
  { id: "41", nome: "Hellas", lat: -42.4, lon: 70.5, preco: null },
  { id: "45", nome: "Argyre", lat: -49.7, lon: -30, preco: null },
  { id: "49", nome: "Terra Meridiani", lat: -2, lon: 6, preco: null },
];