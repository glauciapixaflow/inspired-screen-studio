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
    throw new Error("Não foi possível consultar a disponibilidade das parcelas. Tente atualizar.");
  return data.map((row) => ({
    region_id: row.region_id,
    parcel_id: row.parcel_id,
    status: row.status,
    available_until: row.available_until,
  }));
}
