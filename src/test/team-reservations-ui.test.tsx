import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, list, confirm, resolve } = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  confirm: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/team-reservations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/team-reservations")>()),
  listTeamReservations: list,
  confirmReservationContact: confirm,
  resolveReservation: resolve,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
import { TeamReservationsPage } from "@/components/admin/TeamReservationsPage";
const row = {
  id: "protocol-a",
  user_id: "client-a",
  client_email: "cliente@example.com",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-05T12:00:00Z",
  expires_at: "2026-11-10T12:00:00Z",
  contacted_at: null,
  confirmed_by: null,
  confirmed_by_email: null,
  contact_note: null,
  total_count: 1,
};
function show() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cache}>
      <TeamReservationsPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-05T12:00:00Z"));
  auth.mockReturnValue({
    user: { id: "staff-a", email: "equipe@example.com" },
    role: "collaborator",
    loading: false,
    error: false,
  });
  list.mockResolvedValue([row]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Team reservations screen", () => {
  it("blocks customers before fetching reservations", () => {
    auth.mockReturnValue({
      user: { id: "client-a" },
      role: "client",
      loading: false,
      error: false,
    });
    show();
    expect(screen.getByText("Acesso restrito à equipe")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });
  it("requires login for visitors", () => {
    auth.mockReturnValue({ user: null, role: null, loading: false, error: false });
    show();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/");
    expect(list).not.toHaveBeenCalled();
  });
  it.each(["collaborator", "admin"])("allows %s to view the list", async (role) => {
    auth.mockReturnValue({ user: { id: "staff-a" }, role, loading: false, error: false });
    show();
    expect(await screen.findByText(row.client_email)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar contato" })).toBeEnabled();
  });
  it("requires explicit confirmation before calling the backend", async () => {
    const saved = {
      ...row,
      status: "contacted",
      contacted_at: "2026-11-05T12:01:00Z",
      confirmed_by_email: "equipe@example.com",
      contact_note: "Contato pelo chat.",
    };
    confirm.mockImplementation(async () => {
      list.mockResolvedValue([saved]);
      return saved;
    });
    show();
    await screen.findByText(row.client_email);
    fireEvent.change(screen.getByLabelText("Observação interna (opcional)"), {
      target: { value: "Contato pelo chat." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar contato" }));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar confirmação" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(row.id, "Contato pelo chat."));
    expect(
      await screen.findByText(/A reserva permanece ativa para negociação/),
    ).toBeInTheDocument();
    expect(await screen.findByText("Contato pelo chat.")).toBeInTheDocument();
  });
  it("does not offer confirmation for expired reservations", async () => {
    list.mockResolvedValue([{ ...row, expires_at: "2026-11-05T11:59:59Z" }]);
    show();
    expect(await screen.findByText("Reserva expirada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar contato" })).not.toBeInTheDocument();
  });
  it("shows the original confirmer and note for contacted reservations", async () => {
    list.mockResolvedValue([
      {
        ...row,
        status: "contacted",
        contacted_at: "2026-11-05T12:00:00Z",
        confirmed_by_email: "equipe@example.com",
        contact_note: "Interesse confirmado.",
      },
    ]);
    show();
    expect(await screen.findByText("Responsável: equipe@example.com")).toBeInTheDocument();
    expect(screen.getByText("Interesse confirmado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar contato" })).not.toBeInTheDocument();
  });
  it("does not claim success if the deadline passed on the server", async () => {
    confirm.mockRejectedValue(new Error("O prazo desta reserva venceu."));
    show();
    await screen.findByText(row.client_email);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar contato" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar confirmação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("prazo desta reserva venceu");
    expect(screen.queryByText(/A reserva permanece ativa/)).not.toBeInTheDocument();
  });
  it("searches and filters reservations", async () => {
    show();
    await screen.findByText(row.client_email);
    fireEvent.change(screen.getByLabelText("Buscar reserva"), { target: { value: "protocol-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(list).toHaveBeenCalledWith("protocol-a", null, 0));
    fireEvent.change(screen.getByLabelText("Filtrar por situação"), {
      target: { value: "expired" },
    });
    await waitFor(() => expect(list).toHaveBeenCalledWith("protocol-a", "expired", 0));
  });
});

it("uses the first confirmation history returned by the server after a retry", async () => {
  const first = {
    ...row,
    status: "contacted",
    contacted_at: "2026-11-05T12:01:00Z",
    confirmed_by_email: "primeira-equipe@example.com",
    contact_note: "Primeiro contato registrado.",
  };
  confirm.mockImplementation(async () => {
    list.mockResolvedValue([first]);
    return { id: row.id, status: "contacted", contacted_at: first.contacted_at };
  });
  show();
  await screen.findByText(row.client_email);
  fireEvent.change(screen.getByLabelText("Observação interna (opcional)"), {
    target: { value: "Outra tentativa." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar contato" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar confirmação" }));
  expect(await screen.findByText("Responsável: primeira-equipe@example.com")).toBeInTheDocument();
  expect(screen.getByText("Primeiro contato registrado.")).toBeInTheDocument();
  expect(screen.queryByText("Outra tentativa.")).not.toBeInTheDocument();
});

describe("Negotiation resolution controls", () => {
  const active = {
    ...row,
    status: "contacted",
    contacted_at: "2026-11-05T12:00:00Z",
    negotiation_expires_at: "2026-11-20T12:00:00Z",
  };
  it.each(["confirmed", "deactivated"])("requires review before saving %s", async (decision) => {
    list.mockResolvedValue([active]);
    resolve.mockImplementation(async () => {
      const saved = { ...active, status: decision, resolved_at: "2026-11-05T12:01:00Z" };
      list.mockResolvedValue([saved]);
      return saved;
    });
    show();
    await screen.findByText(row.client_email);
    fireEvent.change(screen.getByLabelText("Encerrar negociação"), { target: { value: decision } });
    fireEvent.change(screen.getByLabelText("Observação do encerramento (opcional)"), {
      target: { value: "Decisão da equipe." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar encerramento" }));
    expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Concluir negociação" }));
    await waitFor(() =>
      expect(resolve).toHaveBeenCalledWith(row.id, decision, "Decisão da equipe."),
    );
    expect(
      await screen.findByText(
        decision === "confirmed"
          ? /Reserva protocol-a confirmada/
          : /Reserva protocol-a desativada/,
      ),
    ).toBeInTheDocument();
  });
  it("removes resolution controls at the negotiation deadline", async () => {
    list.mockResolvedValue([{ ...active, negotiation_expires_at: "2026-11-05T11:59:59Z" }]);
    show();
    expect(await screen.findByText("Reserva desativada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar encerramento" })).not.toBeInTheDocument();
  });
});
