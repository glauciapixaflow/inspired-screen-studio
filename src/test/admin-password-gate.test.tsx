import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, verify, sensitive } = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  sensitive: vi.fn(),
}));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/admin-reauthentication", () => ({ verifyAdminPassword: verify }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";
const user = { id: "admin-a", email: "admin@example.com" };
function Sensitive() {
  sensitive();
  return <p>Dados administrativos</p>;
}
function show() {
  const cache = new QueryClient();
  function view() {
    return (
      <QueryClientProvider client={cache}>
        <AdminPasswordGate>
          <Sensitive />
        </AdminPasswordGate>
      </QueryClientProvider>
    );
  }
  const result = render(view());
  return { ...result, refresh: () => result.rerender(view()) };
}
function submit() {
  fireEvent.change(screen.getByLabelText("Sua senha"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e abrir administração" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user, role: "admin", loading: false, error: false });
  verify.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("Administrator password gate", () => {
  it("requires password and keeps administrative components unmounted", () => {
    show();
    expect(screen.getByLabelText("Conta")).toHaveValue(user.email);
    expect(screen.getByLabelText("Conta")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Sua senha")).toHaveAttribute("type", "password");
    expect(sensitive).not.toHaveBeenCalled();
  });
  it("waits for successful verification before rendering the panel", async () => {
    let finish!: () => void;
    verify.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    show();
    submit();
    expect(await screen.findByRole("button", { name: "Confirmando..." })).toBeDisabled();
    expect(sensitive).not.toHaveBeenCalled();
    finish();
    expect(await screen.findByText("Dados administrativos")).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith(user.id, "test-password");
    expect(screen.queryByLabelText("Sua senha")).not.toBeInTheDocument();
  });
  it("keeps the panel closed and clears the password on failure", async () => {
    verify.mockRejectedValue(new Error("Senha incorreta."));
    show();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta");
    expect(screen.getByLabelText("Sua senha")).toHaveValue("");
    expect(sensitive).not.toHaveBeenCalled();
  });
  it("asks again when the panel is opened a second time", async () => {
    const first = show();
    submit();
    await screen.findByText("Dados administrativos");
    first.unmount();
    sensitive.mockClear();
    show();
    expect(screen.getByLabelText("Sua senha")).toHaveValue("");
    expect(sensitive).not.toHaveBeenCalled();
  });
  it("resets confirmation when the account changes", async () => {
    const view = show();
    submit();
    await screen.findByText("Dados administrativos");
    auth.mockReturnValue({
      user: { id: "admin-b", email: "second@example.com" },
      role: "admin",
      loading: false,
      error: false,
    });
    view.refresh();
    expect(screen.getByLabelText("Sua senha")).toHaveValue("");
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
  });
  it("revokes confirmation on demotion and does not restore it automatically", async () => {
    const view = show();
    submit();
    await screen.findByText("Dados administrativos");
    auth.mockReturnValue({ user, role: "client", loading: false, error: false });
    view.refresh();
    expect(screen.getByRole("alert")).toHaveTextContent("exclusiva de administradores");
    auth.mockReturnValue({ user, role: "admin", loading: false, error: false });
    view.refresh();
    expect(screen.getByLabelText("Sua senha")).toBeInTheDocument();
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
  });
  it("offers returning to the site without opening the panel", () => {
    show();
    expect(screen.getByRole("link", { name: "Cancelar e voltar ao site" })).toHaveAttribute(
      "href",
      "/inicio",
    );
    expect(sensitive).not.toHaveBeenCalled();
  });
  it("does not request a password from a visitor or a client", () => {
    auth.mockReturnValue({ user: null, role: null, loading: false, error: false });
    const view = show();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/");
    auth.mockReturnValue({ user, role: "client", loading: false, error: false });
    view.refresh();
    expect(screen.getByRole("alert")).toHaveTextContent("exclusiva de administradores");
    expect(verify).not.toHaveBeenCalled();
    expect(sensitive).not.toHaveBeenCalled();
  });
});
