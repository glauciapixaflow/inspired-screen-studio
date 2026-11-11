import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    activeProps: _activeProps,
    ...props
  }: {
    to: string;
    children: ReactNode;
    activeProps?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
import { AccountAction } from "@/components/AccountAction";
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function show() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountAction />
    </QueryClientProvider>,
  );
}
describe("Administration link on the homepage", () => {
  it("groups administrator destinations in a menu that opens with the keyboard", () => {
    auth.mockReturnValue({ user: { id: "a" }, role: "admin", loading: false });
    show();
    const trigger = screen.getByRole("button", { name: "Menu do administrador" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menuitem", { name: "Administração" })).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const [name, href] of [
      ["Administração", "/admin"],
      ["Atendimento", "/atendimento"],
      ["Conversas", "/chat"],
      ["Condições comerciais", "/condicoes-comerciais"],
    ]) {
      expect(screen.getByRole("menuitem", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("menuitem", { name: "Sair da conta" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it.each(["client", "collaborator"])("hides the administration link from %s", (role) => {
    auth.mockReturnValue({ user: { id: "b" }, role, loading: false });
    show();
    expect(screen.queryByRole("button", { name: "Menu do administrador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
  });
  it("does not show the link before access is verified", () => {
    auth.mockReturnValue({ user: { id: "a" }, role: "admin", loading: true });
    show();
    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
  });
});

describe("Team attendance link", () => {
  it.each(["admin", "collaborator"])("shows Atendimento for %s", (role) => {
    auth.mockReturnValue({ user: { id: "staff" }, role, loading: false });
    show();
    if (role === "admin") {
      fireEvent.keyDown(screen.getByRole("button", { name: "Menu do administrador" }), {
        key: "ArrowDown",
      });
      expect(screen.getByRole("menuitem", { name: "Atendimento" })).toHaveAttribute(
        "href",
        "/atendimento",
      );
      return;
    }
    expect(screen.getByRole("link", { name: "Atendimento" })).toHaveAttribute(
      "href",
      "/atendimento",
    );
  });
  it("does not show Atendimento for clients", () => {
    auth.mockReturnValue({ user: { id: "client" }, role: "client", loading: false });
    show();
    expect(screen.queryByRole("link", { name: "Atendimento" })).not.toBeInTheDocument();
  });
});
