import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signIn, navigate } = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: signIn } },
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

import { Route } from "@/routes/index";
const Login = Route.options.component as ComponentType;

function submitLogin() {
  render(<Login />);
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "teste@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "senha-de-teste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar na minha conta" }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Login com Supabase", () => {
  it("navigates only after receiving a session", async () => {
    let resolveSignIn!: (value: unknown) => void;
    signIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    submitLogin();
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: "teste@example.com",
        password: "senha-de-teste",
      }),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    resolveSignIn({ data: { session: { access_token: "test" } }, error: null });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/inicio" }));
  });

  it("rejects invalid credentials without navigating", async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
    submitLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira seu e-mail e sua senha");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar na minha conta" })).toBeEnabled();
  });

  it("explains when email confirmation is required", async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { code: "email_not_confirmed" } });
    submitLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirme seu e-mail");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("allows retry after a connection failure", async () => {
    signIn.mockRejectedValue(new Error("offline"));
    submitLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    expect(screen.getByRole("button", { name: "Entrar na minha conta" })).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("Homepage first", () => {
  it("opens the homepage even when an old admin return link is used", async () => {
    window.history.replaceState({}, "", "/?redirect=%2Fadmin");
    signIn.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    submitLogin();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/inicio" }));
    expect(navigate).not.toHaveBeenCalledWith({ to: "/admin" });
  });
});
describe("Login hydration", () => {
  it("prevents native credential submission before hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Login />);
    expect(container.querySelector("#login-email")).toBeDisabled();
    expect(container.querySelector("#login-password")).toBeDisabled();
    expect(container.querySelector('button[type="submit"]')).toBeDisabled();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });
});
