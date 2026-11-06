import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUser, signIn, temporarySignOut, factory, getRole } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signIn: vi.fn(),
  temporarySignOut: vi.fn(),
  factory: vi.fn(),
  getRole: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser } },
  createPasswordVerificationClient: factory,
}));
vi.mock("@/lib/user-profiles", () => ({ getMyRole: getRole }));
import { verifyAdminPassword } from "@/lib/admin-reauthentication";
const user = { id: "admin-a", email: "admin@example.com" };
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user }, error: null });
  getRole.mockResolvedValue("admin");
  signIn.mockResolvedValue({
    data: { user, session: { access_token: "temporary-test-token" } },
    error: null,
  });
  temporarySignOut.mockResolvedValue({ error: null });
  factory.mockReturnValue({ auth: { signInWithPassword: signIn, signOut: temporarySignOut } });
});
describe("Administrator password verification", () => {
  it("verifies the current account using an isolated client and revokes only that temporary session", async () => {
    await expect(verifyAdminPassword(user.id, "correct-password")).resolves.toBeUndefined();
    expect(signIn).toHaveBeenCalledWith({ email: user.email, password: "correct-password" });
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(getRole).toHaveBeenCalledTimes(2);
    expect(temporarySignOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("rejects a wrong password", async () => {
    signIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials" },
    });
    await expect(verifyAdminPassword(user.id, "wrong-password")).rejects.toThrow(
      "confirmar a senha desta conta",
    );
    expect(temporarySignOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("rejects a different current account before checking any password", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "other", email: "other@example.com" } },
      error: null,
    });
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow("sessão mudou");
    expect(factory).not.toHaveBeenCalled();
  });
  it("blocks a non-administrator before making a password attempt", async () => {
    getRole.mockResolvedValue("client");
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow(
      "Somente administradores",
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it("rejects a password response belonging to another user", async () => {
    signIn.mockResolvedValue({ data: { user: { id: "other" }, session: {} }, error: null });
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow(
      "confirmar a senha desta conta",
    );
  });
  it("rejects an account switch while the password is being checked", async () => {
    getUser
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "other" } }, error: null });
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow("sessão mudou");
  });
  it("rechecks permission after password verification", async () => {
    getRole.mockResolvedValueOnce("admin").mockResolvedValueOnce("client");
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow(
      "acesso de administrador foi removido",
    );
  });
  it("handles a network failure without leaving the verification client signed in", async () => {
    signIn.mockRejectedValue(new Error("offline"));
    await expect(verifyAdminPassword(user.id, "password")).rejects.toThrow(
      "Tente novamente em instantes",
    );
    expect(temporarySignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
