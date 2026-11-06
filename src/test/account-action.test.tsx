import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
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
  it("shows a link to the panel for an administrator", () => {
    auth.mockReturnValue({ user: { id: "a" }, role: "admin", loading: false });
    show();
    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("button", { name: "Sair da conta" })).toBeInTheDocument();
  });
  it.each(["client", "collaborator"])("hides the administration link from %s", (role) => {
    auth.mockReturnValue({ user: { id: "b" }, role, loading: false });
    show();
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
