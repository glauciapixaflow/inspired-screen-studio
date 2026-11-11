import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { LOTES } from "@/lib/mars-regions";
import { formatDeadline } from "@/lib/reservations";
import {
  listCommercialTerms,
  saveCommercialTerms,
  parseHundredths,
  validateCommercialInput,
  formatMoney,
  PAYMENT_METHODS,
  type CommercialTerms,
  type CommercialInput,
  type PaymentMethod,
} from "@/lib/commercial-terms";
const decimal = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : (value / 100).toFixed(2).replace(".", ",");
function TermsEditor({
  regionId,
  current,
  onSaved,
}: {
  regionId: string;
  current: CommercialTerms | undefined;
  onSaved: (saved: CommercialTerms) => void;
}) {
  const [kind, setKind] = useState<CommercialTerms["price_kind"]>(
    current?.price_kind ?? "on_request",
  );
  const [price, setPrice] = useState(decimal(current?.price_cents));
  const [entry, setEntry] = useState(decimal(current?.down_payment_cents));
  const [installments, setInstallments] = useState(current?.max_installments?.toString() ?? "");
  const [interest, setInterest] = useState(decimal(current?.monthly_interest_bps));
  const [methods, setMethods] = useState<PaymentMethod[]>(current?.payment_methods ?? []);
  const [notes, setNotes] = useState(current?.payment_notes ?? "");
  const [review, setReview] = useState<CommercialInput | null>(null);
  const [error, setError] = useState("");
  const save = useMutation({ mutationFn: saveCommercialTerms, onSuccess: onSaved });
  function prepare(published: boolean) {
    setError("");
    save.reset();
    try {
      if (installments.trim() && !/^\d+$/.test(installments.trim()))
        throw new Error("Informe um número inteiro de parcelas.");
      const input = validateCommercialInput({
        region_id: regionId,
        price_kind: kind,
        price_cents: kind === "on_request" ? null : parseHundredths(price, "Preço"),
        down_payment_cents: parseHundredths(entry, "Entrada"),
        max_installments: installments.trim() ? Number(installments) : null,
        monthly_interest_bps: parseHundredths(interest, "Juros"),
        payment_methods: methods,
        payment_notes: notes,
        published,
        expected_version: current?.version ?? 0,
      });
      setReview(input);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Confira os valores.");
    }
  }
  const inputClass =
    "mt-2 w-full rounded-md border border-input bg-background p-3 outline-none focus:ring-2 focus:ring-ring";
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      <h2 className="text-2xl">{LOTES.find((row) => row.id === regionId)?.nome}</h2>
      <p className="mt-3 text-sm font-semibold text-primary">
        {current?.published ? "Aprovado para a IA" : "Não publicado para a IA"}
      </p>
      {current && (
        <p className="mt-2 text-xs text-muted-foreground">
          Versão {current.version} · atualizado em {formatDeadline(current.updated_at)} (Brasília).
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Estas condições valem para o atendimento das parcelas desta região. Campos em branco
        significam informação não definida; zero é um valor aprovado, quando permitido.
      </p>
      <fieldset disabled={!!review || save.isPending} className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="commercial-kind" className="text-sm font-semibold">
            Tipo de preço
          </label>
          <select
            id="commercial-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as CommercialTerms["price_kind"])}
            className={inputClass}
          >
            <option value="on_request">Sob consulta</option>
            <option value="fixed">Preço fixo de referência</option>
            <option value="starting_at">A partir de</option>
          </select>
        </div>
        <div>
          <label htmlFor="commercial-price" className="text-sm font-semibold">
            Preço de referência (R$)
          </label>
          <input
            id="commercial-price"
            value={price}
            disabled={kind === "on_request"}
            inputMode="decimal"
            onChange={(event) => setPrice(event.target.value)}
            placeholder="Ex.: 189000,00"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="commercial-entry" className="text-sm font-semibold">
            Entrada (R$)
          </label>
          <input
            id="commercial-entry"
            value={entry}
            inputMode="decimal"
            onChange={(event) => setEntry(event.target.value)}
            placeholder="Não definida"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="commercial-installments" className="text-sm font-semibold">
            Máximo de parcelas
          </label>
          <input
            id="commercial-installments"
            value={installments}
            inputMode="numeric"
            onChange={(event) => setInstallments(event.target.value)}
            placeholder="Não definido"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="commercial-interest" className="text-sm font-semibold">
            Juros mensais (%)
          </label>
          <input
            id="commercial-interest"
            value={interest}
            inputMode="decimal"
            onChange={(event) => setInterest(event.target.value)}
            placeholder="Não definidos"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Preencha 0 somente se a condição for sem juros.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Formas de pagamento aceitas</p>
          <div className="mt-3 space-y-2">
            {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(
              ([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={methods.includes(value)}
                    onChange={(event) =>
                      setMethods(
                        event.target.checked
                          ? [...methods, value]
                          : methods.filter((item) => item !== value),
                      )
                    }
                  />
                  {label}
                </label>
              ),
            )}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="commercial-notes" className="text-sm font-semibold">
            Condições e observações aprovadas
          </label>
          <textarea
            id="commercial-notes"
            maxLength={2000}
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Informe somente condições autorizadas para os clientes."
            className={inputClass}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Use valores sem separador de milhar, como 189000,00. Nenhum preço ilustrativo do site é
            importado automaticamente.
          </p>
        </div>
      </fieldset>
      {review ? (
        <div className="mt-6 space-y-3 rounded-md border border-primary/30 bg-background p-4">
          <h3 className="font-semibold">
            {review.published ? "Revisar aprovação para a IA" : "Revisar rascunho"}
          </h3>
          <p className="text-sm">
            {review.price_kind === "on_request"
              ? "Preço sob consulta"
              : `${review.price_kind === "starting_at" ? "A partir de" : "Preço de referência"}: ${formatMoney(review.price_cents)}`}
          </p>
          <p className="text-sm">
            Entrada: {formatMoney(review.down_payment_cents)} · Parcelas:{" "}
            {review.max_installments ?? "não definidas"} · Juros:{" "}
            {review.monthly_interest_bps === null
              ? "não definidos"
              : `${review.monthly_interest_bps / 100}% ao mês`}
          </p>
          <p className="text-sm">
            Pagamento:{" "}
            {review.payment_methods.map((method) => PAYMENT_METHODS[method]).join(", ") ||
              "não definido"}
          </p>
          {review.payment_notes && (
            <p className="whitespace-pre-wrap break-words text-sm">{review.payment_notes}</p>
          )}
          <p className="text-sm">
            {review.published
              ? "Ao confirmar, a IA poderá usar estas informações nas próximas respostas."
              : "Ao salvar como rascunho, estas condições deixam de estar disponíveis para a IA, inclusive se já estavam aprovadas."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={save.isPending} onClick={() => save.mutate(review)}>
              {save.isPending
                ? "Salvando..."
                : review.published
                  ? "Confirmar aprovação"
                  : "Confirmar rascunho"}
            </Button>
            <Button variant="outline" disabled={save.isPending} onClick={() => setReview(null)}>
              Voltar e editar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => prepare(true)}>Revisar e aprovar para a IA</Button>
          <Button variant="outline" onClick={() => prepare(false)}>
            Salvar como rascunho
          </Button>
        </div>
      )}
      {(error || save.isError) && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error || save.error?.message}
        </p>
      )}
    </section>
  );
}
export function CommercialTermsPage() {
  const auth = useUserRole(),
    cache = useQueryClient();
  const [regionId, setRegionId] = useState("08");
  const [notice, setNotice] = useState("");
  const allowed = !!auth.user && auth.role === "admin" && !auth.loading && !auth.error;
  const listing = useQuery({
    queryKey: ["commercial-terms", auth.user?.id],
    queryFn: listCommercialTerms,
    enabled: allowed,
    retry: false,
    refetchOnWindowFocus: false,
  });
  function saved(row: CommercialTerms) {
    cache.setQueryData<CommercialTerms[]>(["commercial-terms", auth.user?.id], (rows) => [
      ...(rows ?? []).filter((item) => item.region_id !== row.region_id),
      row,
    ]);
    setNotice(
      row.published
        ? "Condições aprovadas e disponíveis para a IA."
        : "Rascunho salvo. A IA não usará estas condições.",
    );
  }
  const current = listing.data?.find((row) => row.region_id === regionId);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-8 text-ink-foreground">
        <Logo />
        <Link to="/admin" className="text-sm underline">
          Voltar à administração
        </Link>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-12">
        <p className="eyebrow text-muted-foreground">Administração</p>
        <h1 className="font-display mt-5 text-4xl sm:text-6xl">Condições comerciais da IA</h1>
        <p className="mt-5 text-muted-foreground">
          Cadastre preços, prazos comerciais e formas de pagamento que o assistente está autorizado
          a informar. A equipe acompanha as conversas e pode assumir o atendimento a qualquer
          momento.
        </p>
        {auth.loading ? (
          <p role="status" className="mt-8">
            Verificando seu acesso...
          </p>
        ) : !allowed ? (
          <p role="alert" className="mt-8">
            Esta área é exclusiva de administradores.
          </p>
        ) : listing.isPending ? (
          <p role="status" className="mt-8">
            Carregando condições...
          </p>
        ) : listing.isError ? (
          <div className="mt-8">
            <p role="alert">{listing.error.message}</p>
            <Button onClick={() => void listing.refetch()} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="my-8 flex flex-wrap items-end gap-4">
              <div className="min-w-56 flex-1">
                <label htmlFor="commercial-region" className="text-sm font-semibold">
                  Região
                </label>
                <select
                  id="commercial-region"
                  value={regionId}
                  onChange={(event) => {
                    setRegionId(event.target.value);
                    setNotice("");
                  }}
                  className="mt-2 w-full rounded-md border border-input bg-background p-3"
                >
                  {LOTES.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.id} · {region.nome}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" onClick={() => void listing.refetch()}>
                Atualizar lista
              </Button>
            </div>
            {notice && (
              <p role="status" className="mb-5 rounded-md border border-primary/30 p-4 text-sm">
                {notice}
              </p>
            )}
            <TermsEditor
              key={`${regionId}-${current?.version ?? 0}`}
              regionId={regionId}
              current={current}
              onSaved={saved}
            />
          </>
        )}
      </div>
    </main>
  );
}
