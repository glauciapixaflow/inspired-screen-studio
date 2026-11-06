import type { AreaReservation } from "@/lib/reservations";

export type ReservationStatus = AreaReservation["status"];
export type TeamReservation = AreaReservation & {
  client_email: string | null;
  confirmed_by: string | null;
  confirmed_by_email: string | null;
  contact_note: string | null;
  total_count: number;
  resolved_by_email?: string | null;
  resolution_reason?: "team_decision" | "negotiation_timeout" | "client_cancelled" | null;
  resolution_note?: string | null;
};
export const TEAM_PAGE_SIZE = 20;

export async function listTeamReservations(
  search: string,
  status: ReservationStatus | null,
  page: number,
): Promise<TeamReservation[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("team_list_reservations", {
    p_search: search.trim(),
    p_status: status,
    p_limit: TEAM_PAGE_SIZE,
    p_offset: page * TEAM_PAGE_SIZE,
  });
  if (error?.code === "42501")
    throw new Error("Seu perfil não permite consultar as reservas da equipe.");
  if (error || !Array.isArray(data))
    throw new Error("Não foi possível carregar as reservas. Tente novamente.");
  return data as TeamReservation[];
}

export async function confirmReservationContact(
  id: string,
  notes: string,
): Promise<AreaReservation> {
  if (notes.length > 2000) throw new Error("A observação deve ter no máximo 2000 caracteres.");
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("confirm_reservation_contact", {
    p_reservation_id: id,
    p_notes: notes.trim(),
  });
  if (error) {
    if (error.code === "42501") throw new Error("Somente a equipe pode confirmar o contato.");
    if (error.code === "P0001")
      throw new Error("O prazo desta reserva venceu. O contato não pode ser confirmado.");
    if (error.code === "P0002") throw new Error("Reserva não encontrada. Atualize a lista.");
    if (error.code === "22023") throw new Error("A observação deve ter no máximo 2000 caracteres.");
    throw new Error("Não foi possível confirmar o contato. Tente novamente.");
  }
  if (!data || data.id !== id || data.status !== "contacted" || !data.contacted_at) {
    throw new Error(
      "Não foi possível verificar a confirmação. Atualize a lista antes de tentar novamente.",
    );
  }
  return data as AreaReservation;
}

export type ReservationDecision = "confirmed" | "deactivated";
export async function resolveReservation(
  id: string,
  decision: ReservationDecision,
  notes: string,
): Promise<AreaReservation> {
  if (notes.length > 2000) throw new Error("A observação deve ter no máximo 2000 caracteres.");
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("resolve_reservation", {
    p_reservation_id: id,
    p_decision: decision,
    p_notes: notes.trim(),
  });
  if (error) {
    if (error.code === "42501") throw new Error("Somente a equipe pode encerrar a negociação.");
    if (error.code === "P0001")
      throw new Error(
        "O prazo de negociação venceu ou o contato ainda não foi confirmado. Atualize a lista.",
      );
    if (error.code === "40001") throw new Error("Esta reserva já foi encerrada. Atualize a lista.");
    if (error.code === "P0002") throw new Error("Reserva não encontrada.");
    throw new Error("Não foi possível encerrar a negociação. Tente novamente.");
  }
  if (!data || data.id !== id || data.status !== decision || !data.resolved_at)
    throw new Error("Não foi possível verificar o encerramento. Atualize a lista.");
  return data as AreaReservation;
}
