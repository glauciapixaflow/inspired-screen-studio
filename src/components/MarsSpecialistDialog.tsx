import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Headset } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/use-user-role";
import { askMars, type MarsMessage } from "@/lib/mars-specialist";
const suggestions = [
  "Quantos lotes estão disponíveis por região?",
  "Qual é o preço em Elysium?",
  "Quais as formas de pagamento?",
  "Como é o clima de Marte?",
  "Qual a temperatura em Marte?",
  "Como é o relevo de Marte?",
  "Quanto dura um dia em Marte?",
];
function Dialogue() {
  const [messages, setMessages] = useState<MarsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [limit, setLimit] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: async (content: string) => {
      // The server also validates the bounded history and never trusts browser roles as instructions.
      let history: MarsMessage[] = [...messages, { role: "user" as const, content }].slice(-12);
      while (history.reduce((sum, item) => sum + item.content.length, 0) > 8000)
        history = history.slice(1);

      setMessages((rows) => [...rows, { role: "user", content }]);
      setDraft("");
      return askMars(history, crypto.randomUUID());
    },
    onSuccess: (reply) => setMessages((rows) => [...rows, { role: "assistant", content: reply }]),
  });
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, ask.isPending]);
  function submit(content: string) {
    if (ask.isPending || !content.trim()) return;
    if (messages.length >= 40) {
      setLimit("Inicie uma nova conversa para continuar.");
      return;
    }
    setLimit("");
    ask.mutate(content.trim());
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(draft);
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Você conversa com um assistente virtual. O Google (Gemini) pode receber suas mensagens para
        responder. Preços e pagamentos usam as condições aprovadas da região. Informações gerais,
        sem previsão meteorológica em tempo real.
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((question) => (
          <Button
            key={question}
            variant="outline"
            size="sm"
            disabled={ask.isPending}
            onClick={() => submit(question)}
            className="h-auto whitespace-normal text-left"
          >
            {question}
          </Button>
        ))}
      </div>
      <div
        ref={log}
        role="log"
        aria-label="Conversa com especialista de Marte"
        aria-live="polite"
        className="min-h-32 max-h-[35vh] space-y-4 overflow-y-auto rounded-md border border-border p-4"
      >
        {!messages.length && (
          <p className="text-sm text-muted-foreground">
            Olá! Posso consultar preços e condições de pagamento aprovados por região e explicar o
            clima e o relevo de Marte. Qual é sua dúvida?
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              {message.role === "user" ? "Você" : "Especialista de IA"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.content}</p>
          </div>
        ))}
        {ask.isPending && (
          <p role="status" className="text-sm">
            Preparando resposta...
          </p>
        )}
      </div>
      {(ask.isError || limit) && (
        <p role="alert" className="text-sm text-destructive">
          {limit || ask.error?.message}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="mars-question" className="text-sm font-semibold">
          Sua pergunta sobre Marte
        </label>
        <textarea
          id="mars-question"
          maxLength={1000}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={ask.isPending}
          className="w-full rounded-md border border-input bg-background p-3"
          placeholder="Pergunte sobre preços, pagamento, clima ou relevo..."
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="submit" disabled={ask.isPending || !draft.trim()}>
            Enviar pergunta
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={ask.isPending}
            onClick={() => {
              setMessages([]);
              setLimit("");
              ask.reset();
            }}
          >
            Nova conversa
          </Button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        Histórico somente nesta janela, até você fechar ou iniciar uma nova conversa.
      </p>
      <p className="text-xs text-muted-foreground">
        Referências:{" "}
        <a
          href="https://science.nasa.gov/mars/facts/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          NASA — Marte
        </a>{" "}
        ·{" "}
        <a
          href="https://science.nasa.gov/solar-system/temperatures-across-our-solar-system/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Temperaturas
        </a>
      </p>
    </>
  );
}
function Access() {
  const auth = useUserRole();
  if (auth.loading) return <p role="status">Verificando sua conta...</p>;
  if (auth.error)
    return (
      <p role="alert">
        Não foi possível verificar sua conta. Reabra a conversa para tentar novamente.
      </p>
    );
  if (!auth.user)
    return (
      <p>
        <Link to="/" className="underline">
          Entre na sua conta
        </Link>{" "}
        para conversar com o especialista.
      </p>
    );
  return <Dialogue key={auth.user.id} />;
}
export function MarsSpecialistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Especialista virtual de Marte</DialogTitle>
          <DialogDescription>
            Preços e pagamentos aprovados, clima, tempo e relevo.
          </DialogDescription>
        </DialogHeader>
        <Button asChild variant="outline" className="h-auto whitespace-normal">
          <Link to="/chat" onClick={() => onOpenChange(false)}>
            <Headset aria-hidden="true" />
            Falar com atendimento humano
          </Link>
        </Button>
        {open && <Access />}
      </DialogContent>
    </Dialog>
  );
}
