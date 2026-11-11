import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ArrowLeft, Send, Headset } from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LOTES } from "@/lib/mars-regions";
import { formatDeadline, reservationStatus } from "@/lib/reservations";
import {
  listChats,
  getChat,
  sendChatMessage,
  changeChatMode,
  requestAssistant,
  type ChatMode,
  type ChatSnapshot,
} from "@/lib/reservation-chat";
const modes: Record<ChatMode, string> = {
  ai: "Assistente de IA",
  waiting_team: "Aguardando equipe",
  human: "Atendimento humano",
};
const authors = {
  client: "Cliente",
  team: "Equipe",
  assistant: "Assistente de IA",
  system: "Aviso do atendimento",
};
function Conversation({ snapshot, userId }: { snapshot: ChatSnapshot; userId: string }) {
  const cache = useQueryClient();
  const log = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const lastMessageId = snapshot.messages.at(-1)?.id;
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const attempt = useRef<{ text: string; id: string } | null>(null);
  const reservation = snapshot.reservation;
  const mode = snapshot.conversation?.status ?? "ai";
  const refresh = () => cache.invalidateQueries({ queryKey: ["reservation-chats", userId] });
  const handoff = useMutation({
    mutationFn: (target: "waiting_team" | "human") => changeChatMode(reservation.id, target),
    onSuccess: () => refresh(),
  });
  const sending = useMutation({
    mutationFn: async () => {
      const text = draft.trim();
      if (attempt.current?.text !== text) attempt.current = { text, id: crypto.randomUUID() };
      const message = await sendChatMessage(reservation.id, text, attempt.current.id);
      setDraft("");
      attempt.current = null;
      await refresh();
      if (snapshot.is_owner && mode === "ai") {
        try {
          await requestAssistant(reservation.id, message.id);
        } catch (failure) {
          const cause = failure instanceof Error ? failure.message : "";
          try {
            await changeChatMode(reservation.id, "waiting_team");
            setNotice(
              [cause, "Sua mensagem foi salva. A equipe humana continuará o atendimento."]
                .filter(Boolean)
                .join(" "),
            );
          } catch {
            setNotice(
              "Sua mensagem foi salva, mas não foi possível chamar a equipe. Use Falar com a equipe para tentar novamente.",
            );
          }
        }
        await refresh();
      }
    },
    onError: () => {
      void refresh();
    },
  });
  useEffect(() => {
    if (followMessages.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lastMessageId, sending.isPending]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sending.isPending && draft.trim()) {
      followMessages.current = true;
      setNotice("");
      sending.mutate();
    }
  }
  return (
    <section
      className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-7"
      aria-label="Conversa da reserva"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">{modes[mode]}</p>
          <h2 className="mt-3 text-2xl">
            {LOTES.find((row) => row.id === reservation.region_id)?.nome ?? reservation.region_id} ·
            Parcela {reservation.parcel_id}
          </h2>
          <p className="mt-2 text-sm">{reservationStatus(reservation)}</p>
          <p className="mt-2 break-all text-xs text-muted-foreground">Reserva: {reservation.id}</p>
        </div>
        {snapshot.is_owner
          ? mode === "ai" && (
              <Button
                variant="outline"
                disabled={handoff.isPending}
                onClick={() => handoff.mutate("waiting_team")}
              >
                <Headset size={16} />
                Falar com a equipe
              </Button>
            )
          : mode !== "human" && (
              <Button disabled={handoff.isPending} onClick={() => handoff.mutate("human")}>
                {snapshot.conversation?.status === "ai"
                  ? "Interromper IA e assumir"
                  : "Assumir atendimento"}
              </Button>
            )}
      </div>
      {snapshot.is_owner && mode === "ai" && (
        <p className="mt-5 rounded-md border border-border bg-background p-4 text-sm">
          Você está conversando com uma IA. Suas mensagens e a situação desta reserva serão enviadas
          ao Google (Gemini) para responder. A IA informa valores e condições aprovados. A equipe
          pode acompanhar e assumir o atendimento; para concluir a reserva, fale com a equipe
          humana.
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Conversar aqui não confirma o contato nem prorroga a reserva. A equipe registra o contato e
        a conclusão em Atendimento.
      </p>
      <div
        ref={log}
        onScroll={() => {
          const node = log.current;
          if (node)
            followMessages.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
        role="log"
        aria-label="Histórico de mensagens"
        aria-live="polite"
        className="my-6 max-h-[50vh] min-h-40 space-y-4 overflow-y-auto rounded-md border border-border bg-background p-4"
      >
        {!snapshot.messages.length && (
          <p className="text-sm text-muted-foreground">
            Envie sua dúvida para iniciar a conversa sobre esta reserva.
          </p>
        )}
        {snapshot.messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-[95%] rounded-md p-4 ${message.sender_kind === "client" ? "ml-auto border border-primary/20 bg-card" : "border border-border"}`}
          >
            <p className="text-xs font-semibold text-primary">{authors[message.sender_kind]}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {formatDeadline(message.created_at)} (Brasília)
            </p>
          </article>
        ))}
        {sending.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            {snapshot.is_owner && mode === "ai"
              ? "Enviando e aguardando resposta..."
              : "Enviando mensagem..."}
          </p>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Exibindo as 100 mensagens mais recentes. Atualização automática.
      </p>
      {mode === "waiting_team" && (
        <p className="mb-4 text-sm">
          A equipe foi avisada na fila de conversas. Aguarde uma resposta por aqui.
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-sm">
          {notice}
        </p>
      )}
      {handoff.isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {handoff.error.message}
        </p>
      )}
      {sending.isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {sending.error.message}
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="chat-message" className="block text-sm font-semibold">
          {snapshot.is_owner ? "Sua mensagem" : "Resposta da equipe"}
        </label>
        <textarea
          id="chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
          maxLength={2000}
          rows={3}
          disabled={sending.isPending}
          className="w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">{draft.length}/2000</span>
          <Button type="submit" disabled={sending.isPending || !draft.trim()}>
            <Send size={16} />
            Enviar mensagem
          </Button>
        </div>
      </form>
    </section>
  );
}
export function ReservationChatPage({ reservationId }: { reservationId?: string | undefined }) {
  const auth = useUserRole();
  const enabled = !!auth.user && !auth.loading && !auth.error;
  const chats = useQuery({
    queryKey: ["reservation-chats", auth.user?.id, "list"],
    queryFn: listChats,
    enabled,
    retry: false,
    refetchInterval: 10_000,
  });
  const detail = useQuery({
    queryKey: ["reservation-chats", auth.user?.id, reservationId],
    queryFn: () => getChat(reservationId!),
    enabled: enabled && !!reservationId,
    retry: false,
    refetchInterval: 5000,
  });
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-8 text-ink-foreground">
        <Logo />
        <Link to="/inicio" className="flex items-center gap-2 text-sm">
          <ArrowLeft size={16} />
          Voltar ao site
        </Link>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="eyebrow flex items-center gap-2 text-muted-foreground">
          <MessageCircle size={16} />
          Conversas
        </p>
        <h1 className="font-display mt-5 text-5xl sm:text-6xl">Atendimento da sua reserva</h1>
        {auth.loading ? (
          <p role="status" className="mt-8">
            Verificando sua conta...
          </p>
        ) : auth.error ? (
          <p role="alert" className="mt-8">
            Não foi possível verificar sua conta. Recarregue a página.
          </p>
        ) : !auth.user ? (
          <p className="mt-8">
            <Link to="/" className="underline">
              Entre na sua conta
            </Link>{" "}
            para conversar com a equipe.
          </p>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold">Conversas recentes</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {auth.role === "client"
                  ? "Suas conversas."
                  : "Fila de clientes e atendimentos da equipe."}{" "}
                Últimas 100 conversas.
              </p>
              {chats.isPending ? (
                <p role="status" className="mt-4 text-sm">
                  Carregando conversas...
                </p>
              ) : chats.isError ? (
                <p role="alert" className="mt-4 text-sm">
                  {chats.error.message}
                </p>
              ) : !chats.data.length ? (
                <p className="mt-4 text-sm">Nenhuma conversa iniciada.</p>
              ) : (
                <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto lg:max-h-[70vh]">
                  {chats.data.map((chat) => (
                    <li key={chat.reservation_id}>
                      <Link
                        to="/chat"
                        search={{ reservation: chat.reservation_id }}
                        className={`block rounded-md border p-3 text-sm ${reservationId === chat.reservation_id ? "border-primary" : "border-border"}`}
                      >
                        <span className="block font-semibold">
                          Região {chat.region_id} · {chat.parcel_id}
                        </span>
                        <span className="mt-1 block text-xs">{modes[chat.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
            {!reservationId ? (
              <p className="rounded-lg border border-dashed border-border p-8">
                Escolha uma conversa na lista ou abra uma reserva em{" "}
                <Link to="/inicio" hash="minhas-reservas" className="underline">
                  Minhas reservas
                </Link>{" "}
                para iniciar o atendimento.
              </p>
            ) : detail.isPending ? (
              <p role="status">Carregando histórico...</p>
            ) : detail.isError ? (
              <div>
                <p role="alert">{detail.error.message}</p>
                <Button variant="outline" className="mt-4" onClick={() => void detail.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <Conversation
                key={`${auth.user.id}-${reservationId}`}
                snapshot={detail.data}
                userId={auth.user.id}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
