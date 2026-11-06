import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { signup, navigate } = vi.hoisted(() => ({ signup: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signUp: signup } } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
import { ClientSignupForm } from "@/components/ClientSignupForm";
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
function fill(confirmation = "senha-forte-123") {
  render(<ClientSignupForm onLogin={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: " Cliente Teste " },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "cliente@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), {
    target: { value: "senha-forte-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
}
describe("Client registration", () => {
  it("blocks mismatched passwords before sending credentials", async () => {
    fill("outra-senha");
    expect(await screen.findByRole("alert")).toHaveTextContent("não coincidem");
    expect(signup).not.toHaveBeenCalled();
  });
  it("sends name metadata without role and waits for email confirmation", async () => {
    signup.mockResolvedValue({ data: { user: { id: "new-client" }, session: null }, error: null });
    fill();
    expect(await screen.findByRole("status")).toHaveTextContent("Confira seu e-mail");
    expect(signup).toHaveBeenCalledWith({
      email: "cliente@example.invalid",
      password: "senha-forte-123",
      options: {
        data: { full_name: "Cliente Teste" },
        emailRedirectTo: window.location.origin + "/",
      },
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Senha", { exact: true })).not.toBeInTheDocument();
  });
  it("opens the homepage only when signup provides a session", async () => {
    signup.mockResolvedValue({
      data: { user: { id: "new-client" }, session: { access_token: "fake" } },
      error: null,
    });
    fill();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/inicio" }));
  });
  it("shows rate limit errors and allows retry", async () => {
    signup.mockResolvedValue({ data: {}, error: { code: "over_email_send_rate_limit" } });
    fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("limite de envio");
    expect(screen.getByRole("button", { name: "Criar minha conta" })).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("handles connection failure without claiming success", async () => {
    signup.mockRejectedValue(new Error("offline"));
    fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    expect(navigate).not.toHaveBeenCalled();
  });
  it("prevents native password submission before hydration", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ClientSignupForm onLogin={vi.fn()} />);
    expect(container.querySelector("#signup-password")).toBeDisabled();
    expect(container.querySelector('button[type="submit"]')).toBeDisabled();
  });
});
