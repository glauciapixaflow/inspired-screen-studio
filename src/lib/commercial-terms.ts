export const PAYMENT_METHODS = {
  pix: "Pix",
  bank_transfer: "Transferência bancária",
  boleto: "Boleto",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export type CommercialTerms = {
  region_id: string;
  price_kind: "fixed" | "starting_at" | "on_request";
  price_cents: number | null;
  down_payment_cents: number | null;
  max_installments: number | null;
  monthly_interest_bps: number | null;
  payment_methods: PaymentMethod[];
  payment_notes: string;
  published: boolean;
  version: number;
  approved_at: string | null;
  updated_at: string;
};
export type CommercialInput = Omit<CommercialTerms, "version" | "approved_at" | "updated_at"> & {
  expected_version: number;
};
export function parseHundredths(value: string, label: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text))
    throw new Error(`${label}: use somente números e até duas casas decimais, como 189000,00.`);
  const parsed = Math.round(Number(text.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(parsed) || parsed > 1000000000000)
    throw new Error(`${label}: valor fora do limite.`);
  return parsed;
}
export function formatMoney(cents: number | null): string {
  return cents === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export function validateCommercialInput(input: CommercialInput) {
  if (input.price_kind !== "on_request" && input.published && input.price_cents === null)
    throw new Error("Informe o preço antes de aprovar.");
  if (input.price_cents !== null && input.price_cents <= 0)
    throw new Error("O preço deve ser maior que zero.");
  if (
    input.price_cents !== null &&
    input.down_payment_cents !== null &&
    input.down_payment_cents > input.price_cents
  )
    throw new Error("A entrada não pode ser maior que o preço.");
  if (
    input.max_installments !== null &&
    (!Number.isInteger(input.max_installments) ||
      input.max_installments < 1 ||
      input.max_installments > 360)
  )
    throw new Error("Informe de 1 a 360 parcelas, ou deixe em branco.");
  if (
    input.monthly_interest_bps !== null &&
    (input.monthly_interest_bps < 0 || input.monthly_interest_bps > 10000)
  )
    throw new Error("Os juros mensais devem ficar entre 0 e 100%, ou em branco.");
  if (input.payment_notes.length > 2000) throw new Error("Use até 2000 caracteres nas condições.");
  return input;
}
export async function listCommercialTerms(): Promise<CommercialTerms[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("admin_list_commercial_terms");
  if (error || !Array.isArray(data))
    throw new Error(
      error?.code === "42501"
        ? "Somente administradores podem consultar este cadastro."
        : "Não foi possível carregar as condições comerciais.",
    );
  return data;
}
export async function saveCommercialTerms(input: CommercialInput): Promise<CommercialTerms> {
  validateCommercialInput(input);
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("admin_save_commercial_terms", {
    p_region_id: input.region_id,
    p_price_kind: input.price_kind,
    p_price_cents: input.price_cents,
    p_down_payment_cents: input.down_payment_cents,
    p_max_installments: input.max_installments,
    p_monthly_interest_bps: input.monthly_interest_bps,
    p_payment_methods: input.payment_methods,
    p_payment_notes: input.payment_notes.trim(),
    p_published: input.published,
    p_expected_version: input.expected_version,
  });
  if (error) {
    if (error.code === "42501")
      throw new Error("Somente administradores podem aprovar condições comerciais.");
    if (error.code === "40001")
      throw new Error("Outro administrador alterou esta região. Atualize a lista antes de salvar.");
    throw new Error("Não foi possível salvar. Confira os dados e tente novamente.");
  }
  if (
    !data ||
    data.region_id !== input.region_id ||
    data.published !== input.published ||
    data.version !== input.expected_version + 1
  )
    throw new Error("Não foi possível verificar a gravação. Atualize a lista.");
  return data;
}
