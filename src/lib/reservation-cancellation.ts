import type { AreaReservation } from "@/lib/reservations";
export async function cancelMyReservation(id: string): Promise<AreaReservation> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("cancel_my_reservation", { p_reservation_id: id });
  if (error) {
    if (error.code === "42501") throw new Error("Entre na sua conta para cancelar sua reserva.");
    if (error.code === "P0002")
      throw new Error("Reserva não encontrada na sua conta. Atualize a lista.");
    if (error.code === "P0001" || error.code === "40001")
      throw new Error("A situação da reserva mudou. Atualize a lista antes de tentar novamente.");
    throw new Error("Não foi possível cancelar sua reserva. Tente novamente.");
  }
  if (!data || data.id !== id || data.status !== "cancelled" || !data.resolved_at)
    throw new Error("Não foi possível verificar o cancelamento. Atualize a lista.");
  return data as AreaReservation;
}
