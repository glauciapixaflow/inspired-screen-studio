import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, list, get, send, mode, assistant } = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  send: vi.fn(),
  mode: vi.fn(),
  assistant: vi.fn(),
}));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/reservation-chat", () => ({
  listChats: list,
  getChat: get,
  sendChatMessage: send,
  changeChatMode: mode,
  requestAssistant: assistant,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
import { ReservationChatPage } from "@/components/ReservationChatPage";
const reservation = {
  id: "reservation-a",
  user_id: "user-a",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-09T12:00:00Z",
  expires_at: "2099-11-14T12:00:00Z",
  contacted_at: null,
};
const snapshot = {
  reservation,
  is_owner: true,
  conversation: { id: "conversation-a", status: "ai", updated_at: reservation.created_at },
  messages: [],
};
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <ReservationChatPage reservationId={reservation.id} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { id: "user-a" }, role: "client", loading: false, error: false });
  list.mockResolvedValue([]);
  get.mockResolvedValue(snapshot);
  send.mockResolvedValue({
    id: "message-a",
    sender_kind: "client",
    content: "Qual o prazo?",
    created_at: reservation.created_at,
  });
  mode.mockResolvedValue(undefined);
  assistant.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("Reservation chat UI", () => {
  it("requires login without querying conversations", () => {
    auth.mockReturnValue({ user: null, loading: false, error: false });
    show();
    expect(screen.getByRole("link", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  it("sends the client's message before requesting a model response", async () => {
    show();
    fireEvent.change(await screen.findByLabelText("Sua mensagem"), {
      target: { value: "Qual o prazo?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await waitFor(() => expect(assistant).toHaveBeenCalledWith(reservation.id, "message-a"));
    expect(send).toHaveBeenCalledWith(reservation.id, "Qual o prazo?", expect.any(String));
  });
  it("queues the team if the AI function is unavailable", async () => {
    assistant.mockRejectedValue(new Error("unavailable"));
    show();
    fireEvent.change(await screen.findByLabelText("Sua mensagem"), {
      target: { value: "Qual o prazo?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await waitFor(() => expect(mode).toHaveBeenCalledWith(reservation.id, "waiting_team"));
    expect(
      await screen.findByText(
        /Sua mensagem foi salva\. A equipe humana continuará o atendimento\./,
      ),
    ).toBeInTheDocument();
  });
  it("allows explicit handoff before any model request", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Falar com a equipe" }));
    await waitFor(() => expect(mode).toHaveBeenCalledWith(reservation.id, "waiting_team"));
    expect(assistant).not.toHaveBeenCalled();
  });
  it("lets staff take over and replies without involving the AI", async () => {
    auth.mockReturnValue({
      user: { id: "staff" },
      role: "collaborator",
      loading: false,
      error: false,
    });
    get.mockResolvedValue({
      ...snapshot,
      is_owner: false,
      conversation: { ...snapshot.conversation, status: "waiting_team" },
    });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Assumir atendimento" }));
    await waitFor(() => expect(mode).toHaveBeenCalledWith(reservation.id, "human"));
    fireEvent.change(screen.getByLabelText("Resposta da equipe"), { target: { value: "Olá!" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(assistant).not.toHaveBeenCalled();
  });
  it("renders message text as text, without executing HTML", async () => {
    get.mockResolvedValue({
      ...snapshot,
      messages: [
        {
          id: "html",
          sender_kind: "client",
          content: '<img src=x onerror="alert(1)">',
          created_at: reservation.created_at,
        },
      ],
    });
    show();
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
