import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { createClient, reset, setSession, getUser, updateUser, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  reset: vi.fn(),
  setSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { resetPasswordForEmail: reset } } }));
import { openPasswordRecovery, requestPasswordRecovery } from "@/lib/password-recovery";
const fragment = "#access_token=fake-access&refresh_token=fake-refresh&type=recovery";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fake-publishable");
  createClient.mockReturnValue({ auth: { setSession, getUser, updateUser, signOut } });
  setSession.mockResolvedValue({
    data: { session: {}, user: { id: "recovery-user" } },
    error: null,
  });
  getUser.mockResolvedValue({ data: { user: { id: "recovery-user" } }, error: null });
  updateUser.mockResolvedValue({ data: { user: { id: "recovery-user" } }, error: null });
  signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("Recovery request", () => {
  it("uses the recovery route on the current origin", async () => {
    reset.mockResolvedValue({ error: null });
    await requestPasswordRecovery(" cliente@example.invalid ");
    expect(reset).toHaveBeenCalledWith("cliente@example.invalid", {
      redirectTo: window.location.origin + "/redefinir-senha",
    });
  });
  it("shows rate limiting without claiming an email was sent", async () => {
    reset.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
    await expect(requestPasswordRecovery("cliente@example.invalid")).rejects.toThrow("limite");
  });
});
describe("Recovery link", () => {
  it.each([
    "",
    "#access_token=fake&refresh_token=fake&type=signup",
    "#type=recovery",
    "#error=access_denied&error_code=otp_expired",
  ])("refuses missing, non-recovery and expired links", async (hash) => {
    await expect(openPasswordRecovery(hash)).rejects.toThrow("inválido ou venceu");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("uses an isolated memory-only session and validates the recovered identity", async () => {
    await openPasswordRecovery(fragment);
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "fake-publishable", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: expect.stringContaining("password-recovery-"),
      },
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "fake-access",
      refresh_token: "fake-refresh",
    });
    expect(getUser).toHaveBeenCalled();
  });
  it("rejects a failed session and clears it without revealing server details", async () => {
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "internal-detail" },
    });
    await expect(openPasswordRecovery(fragment)).rejects.toThrow("inválido ou venceu");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("does not update a different identity", async () => {
    const access = await openPasswordRecovery(fragment);
    getUser.mockResolvedValue({ data: { user: { id: "other-user" } }, error: null });
    await expect(access.updatePassword("nova-senha-123")).rejects.toThrow("inválido ou venceu");
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("updates only the password and closes only the recovery session", async () => {
    const access = await openPasswordRecovery(fragment);
    await access.updatePassword("nova-senha-123");
    expect(updateUser).toHaveBeenCalledWith({ password: "nova-senha-123" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    await expect(access.updatePassword("outra-senha-123")).rejects.toThrow("inválido ou venceu");
    expect(updateUser).toHaveBeenCalledTimes(1);
  });
  it("allows a retry when a stronger password is required", async () => {
    const access = await openPasswordRecovery(fragment);
    updateUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "weak_password" } });
    await expect(access.updatePassword("nova-senha-123")).rejects.toThrow("mais forte");
    expect(signOut).not.toHaveBeenCalled();
    await access.updatePassword("nova-senha-forte-123!");
  });
});
