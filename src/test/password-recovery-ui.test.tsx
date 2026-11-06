import { StrictMode, type ReactNode, type ComponentType } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { request, open, update, close } = vi.hoisted(() => ({
  request: vi.fn(),
  open: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/lib/password-recovery", () => ({
  requestPasswordRecovery: request,
  openPasswordRecovery: open,
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
import { Route as RequestRoute } from "@/routes/recuperar-senha";
import { Route as ResetRoute } from "@/routes/redefinir-senha";
const RequestPasswordRecovery = RequestRoute.options.component as ComponentType;
const ResetPassword = ResetRoute.options.component as ComponentType;
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(
    {},
    "",
    "/redefinir-senha#type=recovery&access_token=fake&refresh_token=fake",
  );
  open.mockResolvedValue({ updatePassword: update, close });
  request.mockResolvedValue(undefined);
  update.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});
describe("Recovery request screen", () => {
  it("uses a neutral confirmation without disclosing whether the account exists", async () => {
    render(<RequestPasswordRecovery />);
    fireEvent.change(screen.getByLabelText("E-mail cadastrado"), {
      target: { value: "cliente@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Se houver uma conta");
    expect(request).toHaveBeenCalledWith("cliente@example.invalid");
  });
  it("shows failed sending as an error", async () => {
    request.mockRejectedValue(new Error("Limite atingido."));
    render(<RequestPasswordRecovery />);
    fireEvent.change(screen.getByLabelText("E-mail cadastrado"), {
      target: { value: "cliente@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite atingido");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
describe("New password screen", () => {
  it("waits for link validation and removes URL credentials, including in StrictMode", async () => {
    render(
      <StrictMode>
        <ResetPassword />
      </StrictMode>,
    );
    expect(await screen.findByLabelText("Nova senha")).toBeEnabled();
    expect(open).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });
  it("does not display password fields for an invalid link", async () => {
    open.mockRejectedValue(new Error("invalid"));
    render(<ResetPassword />);
    expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou venceu");
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar novo link" })).toHaveAttribute(
      "href",
      "/recuperar-senha",
    );
  });
  it("blocks mismatched passwords without calling the server", async () => {
    render(<ResetPassword />);
    fireEvent.change(await screen.findByLabelText("Nova senha"), {
      target: { value: "nova-senha-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "outra-senha-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não coincidem");
    expect(update).not.toHaveBeenCalled();
  });
  it("shows success only after the server saves the new password", async () => {
    render(<ResetPassword />);
    fireEvent.change(await screen.findByLabelText("Nova senha"), {
      target: { value: "nova-senha-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "nova-senha-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Senha atualizada"));
    expect(update).toHaveBeenCalledWith("nova-senha-123");
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  });
  it("clears the password fields on save failure without claiming success", async () => {
    update.mockRejectedValue(new Error("Escolha outra senha."));
    render(<ResetPassword />);
    fireEvent.change(await screen.findByLabelText("Nova senha"), {
      target: { value: "nova-senha-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "nova-senha-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha outra senha");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.queryByText("Senha atualizada")).not.toBeInTheDocument();
  });
});

it("validates a replacement email link in the same mounted page", async () => {
  render(<ResetPassword />);
  expect(await screen.findByLabelText("Nova senha")).toBeEnabled();
  open.mockRejectedValueOnce(new Error("expired"));
  window.history.replaceState(
    {},
    "",
    "/redefinir-senha#error=access_denied&error_code=otp_expired",
  );
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou venceu");
  expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  window.history.replaceState(
    {},
    "",
    "/redefinir-senha#type=recovery&access_token=another-fake&refresh_token=fake",
  );
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(await screen.findByLabelText("Nova senha")).toBeEnabled();
  expect(window.location.hash).toBe("");
});
