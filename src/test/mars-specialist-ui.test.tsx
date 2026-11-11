import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const { auth, ask } = vi.hoisted(() => ({ auth: vi.fn(), ask: vi.fn() }));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/mars-specialist", () => ({ askMars: ask }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
import { MarsSpecialistDialog } from "@/components/MarsSpecialistDialog";
function show(open = true) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MarsSpecialistDialog open={open} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { id: "client" }, loading: false, error: false });
  ask.mockResolvedValue("Marte tem atmosfera fina e clima frio.");
});
afterEach(cleanup);
describe("Mars specialist dialogue", () => {
  it("requires login without invoking Gemini", () => {
    auth.mockReturnValue({ user: null, loading: false, error: false });
    show();
    expect(screen.getByRole("link", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Sua pergunta sobre Marte")).not.toBeInTheDocument();
    expect(ask).not.toHaveBeenCalled();
  });
  it("answers without a reservation, shows NASA references and preserves dialogue context", async () => {
    show();
    expect(screen.getByText(/sem previsão meteorológica em tempo real/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "NASA — Marte" })).toHaveAttribute(
      "href",
      "https://science.nasa.gov/mars/facts/",
    );
    fireEvent.click(screen.getByRole("button", { name: "Como é o clima de Marte?" }));
    expect(await screen.findByText("Marte tem atmosfera fina e clima frio.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Sua pergunta sobre Marte"), {
      target: { value: "E o relevo?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[1]![0]).toEqual([
      { role: "user", content: "Como é o clima de Marte?" },
      { role: "assistant", content: "Marte tem atmosfera fina e clima frio." },
      { role: "user", content: "E o relevo?" },
    ]);
  });
  it("disables repeated submissions while waiting and reports failures without false handoff", async () => {
    ask.mockRejectedValue(new Error("Limite de perguntas atingido."));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Como é o relevo de Marte?" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de perguntas");
    expect(screen.queryByText(/encaminhada à equipe/)).not.toBeInTheDocument();
  });
  it("clears dialogue when starting a new conversation", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Quanto dura um dia em Marte?" }));
    await screen.findByText("Marte tem atmosfera fina e clima frio.");
    fireEvent.click(screen.getByRole("button", { name: "Nova conversa" }));
    expect(screen.queryByText("Marte tem atmosfera fina e clima frio.")).not.toBeInTheDocument();
  });
  it("renders model replies as plain text", async () => {
    ask.mockResolvedValue("<img src=x onerror=alert(1)>");
    show();
    fireEvent.click(screen.getByRole("button", { name: "Qual a temperatura em Marte?" }));
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

it("lets a client ask about approved prices from the specialist button without starting a team conversation", async () => {
  ask.mockResolvedValue(
    "Condições aprovadas para Elysium: Preço de referência R$ 12.345,67. Pagamento: Pix.",
  );
  show();
  fireEvent.click(screen.getByRole("button", { name: "Qual é o preço em Elysium?" }));
  expect(await screen.findByText(/Condições aprovadas para Elysium/)).toBeInTheDocument();
  expect(ask).toHaveBeenCalledWith(
    [{ role: "user", content: "Qual é o preço em Elysium?" }],
    expect.any(String),
  );
  expect(screen.queryByText(/encaminhada à equipe/)).not.toBeInTheDocument();
});
