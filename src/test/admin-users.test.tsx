import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, listUsers, changeRole } = vi.hoisted(() => ({
  auth: vi.fn(),
  listUsers: vi.fn(),
  changeRole: vi.fn(),
}));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/user-profiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/user-profiles")>()),
  listAdminUsers: listUsers,
  changeUserRole: changeRole,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to} {...props}>
      {children}
    </a>
  ),
}));
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";
const row = {
  user_id: "client-b",
  email: "cliente@example.com",
  role: "client",
  created_at: "2026-11-04T12:00:00Z",
  updated_at: "2026-11-04T12:00:00Z",
  total_count: 1,
};
function show() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={cache}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
  return { ...result, cache };
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { id: "admin-a" }, role: "admin", loading: false, error: false });
  listUsers.mockResolvedValue([row]);
});
afterEach(cleanup);
describe("Administrator screen", () => {
  it.each(["client", "collaborator"])("blocks %s without loading user emails", (role) => {
    auth.mockReturnValue({ user: { id: "other" }, role, loading: false, error: false });
    show();
    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
    expect(listUsers).not.toHaveBeenCalled();
    expect(screen.queryByText(row.email)).not.toBeInTheDocument();
  });
  it("requires login for visitors", () => {
    auth.mockReturnValue({ user: null, role: null, loading: false, error: false });
    show();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/");
    expect(listUsers).not.toHaveBeenCalled();
  });
  it("does not load privileged data while checking access or after an access error", () => {
    auth.mockReturnValue({ user: { id: "admin-a" }, role: "admin", loading: true, error: false });
    const view = show();
    expect(screen.getByText("Verificando seu acesso...")).toBeInTheDocument();
    expect(listUsers).not.toHaveBeenCalled();
    auth.mockReturnValue({ user: { id: "admin-a" }, role: "admin", loading: false, error: true });
    view.rerender(
      <QueryClientProvider client={view.cache}>
        <AdminUsersPage />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível verificar");
    expect(listUsers).not.toHaveBeenCalled();
  });
  it("searches and filters on the protected listing", async () => {
    show();
    await screen.findByText(row.email);
    fireEvent.change(screen.getByLabelText("Buscar usuário"), { target: { value: " cliente " } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith("cliente", null, 0));
    fireEvent.change(screen.getByLabelText("Filtrar por perfil"), {
      target: { value: "collaborator" },
    });
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith("cliente", "collaborator", 0));
  });
  it("requires confirmation and reports success only after saving", async () => {
    let finish!: (value: unknown) => void;
    changeRole.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show();
    await screen.findByText(row.email);
    fireEvent.change(screen.getByRole("combobox", { name: `Perfil de ${row.email}` }), {
      target: { value: "collaborator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(changeRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
    await waitFor(() => expect(changeRole).toHaveBeenCalledWith(row.user_id, "collaborator"));
    expect(await screen.findByRole("button", { name: "Salvando..." })).toBeDisabled();
    expect(screen.queryByText(/Perfil de .* alterado para/)).not.toBeInTheDocument();
    finish({ ...row, role: "collaborator" });
    expect(
      await screen.findByText(`Perfil de ${row.email} alterado para Colaborador.`),
    ).toBeInTheDocument();
  });
  it("shows database rejection without claiming success", async () => {
    listUsers.mockResolvedValue([{ ...row, user_id: "admin-a", role: "admin" }]);
    changeRole.mockRejectedValue(new Error("É necessário manter pelo menos um administrador."));
    show();
    await screen.findByText(row.email);
    fireEvent.change(screen.getByRole("combobox", { name: `Perfil de ${row.email}` }), {
      target: { value: "client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(screen.getByText(/Você perderá o acesso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos um administrador");
    expect(screen.queryByText(/Perfil de .* alterado para/)).not.toBeInTheDocument();
  });
  it("clears privileged list data when the administrator demotes themselves", async () => {
    listUsers.mockResolvedValue([{ ...row, user_id: "admin-a", role: "admin" }]);
    changeRole.mockResolvedValue({ ...row, user_id: "admin-a", role: "client" });
    const view = show();
    await screen.findByText(row.email);
    fireEvent.change(screen.getByRole("combobox", { name: `Perfil de ${row.email}` }), {
      target: { value: "client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
    await waitFor(() => expect(view.cache.getQueryData(["user-role", "admin-a"])).toBe("client"));
    auth.mockReturnValue({ user: { id: "admin-a" }, role: "client", loading: false, error: false });
    view.rerender(
      <QueryClientProvider client={view.cache}>
        <AdminUsersPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
    expect(screen.queryByText(row.email)).not.toBeInTheDocument();
  });
  it("paginates results and resets the page when searching", async () => {
    listUsers.mockResolvedValue([{ ...row, total_count: 21 }]);
    show();
    await screen.findByText(row.email);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith("", null, 1));
    await screen.findByText(row.email);
    fireEvent.change(screen.getByLabelText("Buscar usuário"), { target: { value: "novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith("novo", null, 0));
  });
  it("handles empty results and load failures", async () => {
    listUsers.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Sem acesso à lista."));
    show();
    expect(await screen.findByText(/Nenhum usuário encontrado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar lista" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem acesso à lista");
  });
});
