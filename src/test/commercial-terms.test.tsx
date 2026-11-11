import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { auth, list, save } = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/hooks/use-user-role", () => ({ useUserRole: auth }));
vi.mock("@/lib/commercial-terms", async (original) => ({
  ...(await original<typeof import("@/lib/commercial-terms")>()),
  listCommercialTerms: list,
  saveCommercialTerms: save,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
import { CommercialTermsPage } from "@/components/admin/CommercialTermsPage";
import { parseHundredths } from "@/lib/commercial-terms";
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <CommercialTermsPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { id: "admin" }, role: "admin", loading: false, error: false });
  list.mockResolvedValue([]);
  save.mockImplementation(async (input) => ({
    ...input,
    version: input.expected_version + 1,
    updated_at: "2026-11-09T12:00:00Z",
  }));
});
afterEach(cleanup);
describe("Approved commercial conditions", () => {
  it("preserves blank versus zero and rejects ambiguous money inputs", () => {
    expect(parseHundredths("", "Price")).toBeNull();
    expect(parseHundredths("0", "Price")).toBe(0);
    expect(parseHundredths("12345,67", "Price")).toBe(1234567);
    for (const value of ["1.234,56", "-2", "1e3", "1,234"])
      expect(() => parseHundredths(value, "Price")).toThrow();
  });
  it.each(["client", "collaborator"])("blocks %s from loading the approval screen", (role) => {
    auth.mockReturnValue({ user: { id: "other" }, role, loading: false, error: false });
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("exclusiva de administradores");
    expect(list).not.toHaveBeenCalled();
  });
  it("requires a review and confirmation before publishing, with no illustrative price prefilled", async () => {
    show();
    const price = await screen.findByLabelText("Preço de referência (R$)");
    expect(price).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Tipo de preço"), { target: { value: "fixed" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar e aprovar para a IA" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o preço");
    fireEvent.change(price, { target: { value: "12345,67" } });
    fireEvent.change(screen.getByLabelText("Juros mensais (%)"), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("Pix"));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e aprovar para a IA" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          price_cents: 1234567,
          down_payment_cents: null,
          monthly_interest_bps: 0,
          payment_methods: ["pix"],
          published: true,
          expected_version: 0,
        }),
        expect.anything(),
      ),
    );
    expect(
      await screen.findByText("Condições aprovadas e disponíveis para a IA."),
    ).toBeInTheDocument();
  });
  it("warns that saving a draft withdraws approval and never reports a failed save as approved", async () => {
    save.mockRejectedValue(new Error("Outro administrador alterou esta região."));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Salvar como rascunho" }));
    expect(screen.getByText(/inclusive se já estavam aprovadas/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rascunho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Outro administrador");
    expect(
      screen.queryByText("Condições aprovadas e disponíveis para a IA."),
    ).not.toBeInTheDocument();
  });
});
