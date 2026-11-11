import { explainAiFailure } from "@/lib/ai-errors";
import type { AreaReservation } from "@/lib/reservations";
export type ChatMode = "ai" | "waiting_team" | "human";
export type ChatMessage = {
  id: string;
  sender_kind: "client" | "team" | "assistant" | "system";
  content: string;
  created_at: string;
};
export type ChatSnapshot = {
  reservation: AreaReservation;
  is_owner: boolean;
  conversation: { id: string; status: ChatMode; updated_at: string } | null;
  messages: ChatMessage[];
};
export type ChatSummary = {
  reservation_id: string;
  region_id: string;
  parcel_id: string;
  conversation_id: string;
  status: ChatMode;
  updated_at: string;
};
async function rpc(name: string, args?: Record<string, unknown>) {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "42501")
      throw new Error("Entre com uma conta autorizada para acessar esta conversa.");
    if (error.code === "P0002") throw new Error("Conversa ou reserva não encontrada na sua conta.");
    if (error.code === "54000")
      throw new Error("Aguarde um minuto antes de enviar mais mensagens.");
    if (error.code === "55000")
      throw new Error("Aguarde a resposta automática ou chame a equipe humana.");
    if (error.code === "22023") throw new Error("Envie uma mensagem com até 2000 caracteres.");
    throw new Error("Não foi possível acessar o chat. Tente novamente.");
  }
  return data;
}
export async function listChats(): Promise<ChatSummary[]> {
  const data = await rpc("list_reservation_chats");
  if (!Array.isArray(data)) throw new Error("Não foi possível carregar as conversas.");
  return data;
}
export async function getChat(reservationId: string): Promise<ChatSnapshot> {
  const data = await rpc("get_reservation_chat", { p_reservation_id: reservationId });
  if (!data?.reservation || !Array.isArray(data.messages))
    throw new Error("Não foi possível carregar a conversa.");
  return data;
}
export async function sendChatMessage(
  reservationId: string,
  content: string,
  requestId: string,
): Promise<ChatMessage> {
  if (!content.trim() || content.trim().length > 2000)
    throw new Error("Envie uma mensagem com até 2000 caracteres.");
  const data = await rpc("send_reservation_chat", {
    p_reservation_id: reservationId,
    p_content: content.trim(),
    p_request_id: requestId,
  });
  if (!data?.id) throw new Error("Não foi possível confirmar o envio da mensagem.");
  return data;
}
export async function changeChatMode(reservationId: string, mode: "waiting_team" | "human") {
  await rpc("set_reservation_chat_mode", { p_reservation_id: reservationId, p_mode: mode });
}
export async function requestAssistant(reservationId: string, messageId: string) {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.functions.invoke("reservation-assistant", {
    body: { reservation_id: reservationId, message_id: messageId },
  });
  if (error)
    throw new Error(
      await explainAiFailure(
        error,
        "Sua mensagem foi salva, mas a IA está indisponível. Você pode chamar a equipe humana.",
      ),
    );
}
