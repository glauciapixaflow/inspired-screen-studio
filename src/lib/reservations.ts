import { LOTES } from "@/lib/mars-regions";

export type AreaReservation = {
  id: string;
  user_id: string;
  region_id: string;
  parcel_id: string;
  status: "pending_contact" | "contacted" | "confirmed" | "deactivated" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  contacted_at: string | null;
  negotiation_expires_at?: string | null;
  resolved_at?: string | null;
};

const columns =
  "id,user_id,region_id,parcel_id,status,created_at,expires_at,contacted_at,negotiation_expires_at,resolved_at";

export function negotiationDeadline(reservation: AreaReservation): string | null {
  if (reservation.negotiation_expires_at) return reservation.negotiation_expires_at;
  return reservation.contacted_at
    ? new Date(Date.parse(reservation.contacted_at) + 360 * 60 * 60 * 1000).toISOString()
    : null;
}

export function isReservationActive(reservation: AreaReservation, now = Date.now()): boolean {
  if (reservation.status === "confirmed") return true;
  if (reservation.status === "contacted") {
    const deadline = negotiationDeadline(reservation);
    return !!deadline && Date.parse(deadline) > now;
  }
  return reservation.status === "pending_contact" && Date.parse(reservation.expires_at) > now;
}

export function reservationStatus(reservation: AreaReservation, now = Date.now()): string {
  if (reservation.status === "confirmed") return "Reserva confirmada";
  if (reservation.status === "deactivated") return "Reserva desativada";
  if (reservation.status === "cancelled") return "Reserva cancelada";
  if (reservation.status === "contacted")
    return isReservationActive(reservation, now) ? "Contato confirmado" : "Reserva desativada";
  return isReservationActive(reservation, now) ? "Aguardando contato" : "Reserva expirada";
}
export function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export class LoginRequiredError extends Error {
  constructor() {
    super("Entre na sua conta para reservar uma área.");
  }
}

export async function listReservations(userId: string): Promise<AreaReservation[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("area_reservation_details")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<AreaReservation[]>();
  if (error) throw new Error("Não foi possível carregar suas reservas. Tente novamente.");
  return data ?? [];
}

export async function reserveArea(regionId: string, parcelId: string): Promise<AreaReservation> {
  if (!LOTES.some((region) => region.id === regionId) || !/^[A-D][1-4]$/.test(parcelId)) {
    throw new Error("Selecione uma região e uma parcela válidas.");
  }
  const { supabase } = await import("@/lib/supabase");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new LoginRequiredError();

  const { data, error } = await supabase
    .from("area_reservations")
    .insert({ region_id: regionId, parcel_id: parcelId })
    .select(columns)
    .single<AreaReservation>();
  if (!error && data) return data;

  if (error?.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("area_reservation_details")
      .select(columns)
      .eq("user_id", auth.user.id)
      .eq("region_id", regionId)
      .eq("parcel_id", parcelId)
      .in("status", ["pending_contact", "contacted", "confirmed"])
      .maybeSingle<AreaReservation>();
    if (lookupError) throw new Error("Não foi possível verificar a reserva. Tente novamente.");
    if (existing) return existing;
    throw new Error("Esta parcela já possui uma reserva. Escolha outra área.");
  }
  throw new Error("Não foi possível salvar sua reserva. Tente novamente em instantes.");
}
