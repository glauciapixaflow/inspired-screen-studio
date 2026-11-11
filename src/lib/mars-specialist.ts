import { explainAiFailure } from "@/lib/ai-errors";
export type MarsMessage = { role: "user" | "assistant"; content: string };
export async function askMars(messages: MarsMessage[], requestId: string): Promise<string> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.functions.invoke("reservation-assistant", {
    body: { mode: "mars", request_id: requestId, messages },
  });
  if (error)
    throw new Error(
      await explainAiFailure(
        error,
        "O especialista está indisponível agora. Tente novamente mais tarde.",
      ),
    );
  if (typeof data?.reply !== "string" || !data.reply.trim()) {
    if (data?.state)
      throw new Error(
        "A função publicada ainda usa o atendimento antigo. Republique reservation-assistant com os dois arquivos atualizados para o especialista de Marte.",
      );
    throw new Error(
      "O especialista não retornou uma resposta válida. Confira a publicação da função.",
    );
  }
  return data.reply;
}
