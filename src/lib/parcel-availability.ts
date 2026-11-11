import { REGION_LOT_IDS } from "@/lib/mars-regions";

export function regionLotAvailability(regionId: string, rows: ParcelAvailability[]) {
  const occupied = new Map(
    rows
      .filter((row) => row.region_id === regionId && REGION_LOT_IDS.includes(row.parcel_id))
      .map((row) => [row.parcel_id, row.status]),
  );
  const confirmed = [...occupied.values()].filter((status) => status === "confirmed").length;
  return {
    total: REGION_LOT_IDS.length,
    available: REGION_LOT_IDS.length - occupied.size,
    reserved: occupied.size - confirmed,
    confirmed,
  };
}

export type ParcelAvailability = {
  region_id: string;
  parcel_id: string;
  status: "reserved" | "confirmed";
  available_until: string | null;
};
export function activeParcelAvailability(rows: ParcelAvailability[], now: number) {
  return rows.filter(
    (row) =>
      row.status === "confirmed" ||
      (!!row.available_until && Date.parse(row.available_until) > now),
  );
}
export async function listParcelAvailability(): Promise<ParcelAvailability[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("map_area_availability");
  if (error || !Array.isArray(data))
    throw new Error("Não foi possível consultar a disponibilidade dos lotes. Tente atualizar.");
  return data.map((row) => ({
    region_id: row.region_id,
    parcel_id: row.parcel_id,
    status: row.status,
    available_until: row.available_until,
  }));
}
