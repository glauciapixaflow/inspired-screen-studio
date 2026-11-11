import { beforeEach, describe, expect, it, vi } from "vitest";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke } } }));
import { explainAiFailure } from "@/lib/ai-errors";
import { askMars } from "@/lib/mars-specialist";
import { requestAssistant } from "@/lib/reservation-chat";
beforeEach(() => vi.clearAllMocks());
describe("Safe client AI errors", () => {
  it("shows a known cause without showing arbitrary server details", async () => {
    const context = new Response(
      JSON.stringify({ error_code: "GEMINI_QUOTA", error: "secret key and private message" }),
      { status: 503 },
    );
    const text = await explainAiFailure({ context }, "fallback");
    expect(text).toContain("limite de uso");
    expect(text).not.toContain("secret");
  });
  it("ignores unknown error codes and arbitrary messages", async () => {
    expect(
      await explainAiFailure(
        {
          context: new Response(JSON.stringify({ error_code: "secret", error: "private" }), {
            status: 503,
          }),
        },
        "fallback",
      ),
    ).toBe("fallback");
  });
  it.each([
    [401, "autenticar"],
    [404, "não foi encontrada"],
    [429, "Limite de perguntas"],
  ])("explains gateway status %i", async (status, text) => {
    expect(
      await explainAiFailure(
        { context: new Response("not JSON", { status: Number(status) }) },
        "fallback",
      ),
    ).toContain(String(text));
  });
  it("recognizes an old deployed function without falsely promising specialist handoff", async () => {
    invoke.mockResolvedValue({ data: { state: "waiting_team" }, error: null });
    await expect(askMars([{ role: "user", content: "Clima?" }], "request")).rejects.toThrow(
      "atendimento antigo",
    );
  });
  it("passes Gemini configuration failures to the reservation UI", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error_code: "AI_KEY_MISSING" }), { status: 503 }),
      },
    });
    await expect(requestAssistant("reservation", "message")).rejects.toThrow("chave Gemini");
  });
});
