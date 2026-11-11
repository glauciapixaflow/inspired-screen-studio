const messages: Record<string, string> = {
  AI_KEY_MISSING: "A chave Gemini ainda não foi configurada na função.",
  AI_MODEL_INVALID: "Confira o nome do modelo Gemini configurado.",
  GEMINI_ACCESS_DENIED:
    "O Google recusou o acesso à IA. Confira a chave e as permissões do projeto.",
  GEMINI_MODEL_UNAVAILABLE: "O modelo Gemini configurado não está disponível para o projeto.",
  GEMINI_QUOTA: "O Gemini atingiu o limite de uso. Aguarde a liberação da cota.",
  GEMINI_REQUEST_REJECTED:
    "O Gemini recusou a solicitação. A configuração da integração precisa ser revisada.",
  AI_TIMEOUT: "O Gemini demorou para responder. Tente novamente mais tarde.",
  AI_OUTPUT_INVALID: "A resposta da IA não pôde ser validada. Tente novamente mais tarde.",
  AI_DATABASE_MISSING: "Falta aplicar uma migração do atendimento no Supabase.",
  AI_DATABASE_UNAVAILABLE: "Não foi possível consultar a configuração do atendimento.",
  AI_UNAVAILABLE: "O serviço de IA está temporariamente indisponível.",
};
export async function explainAiFailure(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return fallback;
  try {
    const body = (await context.clone().json()) as { error_code?: unknown };
    if (typeof body?.error_code === "string" && Object.hasOwn(messages, body.error_code))
      return messages[body.error_code]!;
  } catch {
    /* Gateway errors may not contain JSON. */
  }
  if (context.status === 401)
    return "Não foi possível autenticar o chat. Entre novamente na conta e confira a publicação da função.";
  if (context.status === 404)
    return "A função de IA não foi encontrada. Confira a publicação no projeto Supabase.";
  if (context.status === 429)
    return "Limite de perguntas atingido. Aguarde antes de tentar novamente.";
  return fallback;
}
