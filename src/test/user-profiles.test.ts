import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
import { changeUserRole, getMyRole, type AppRole } from "@/lib/user-profiles";

beforeEach(() => vi.clearAllMocks());
describe("User access roles", () => {
  it("loads the caller's role without accepting another user's ID", async () => {
    rpc.mockResolvedValue({ data: "collaborator", error: null });
    await expect(getMyRole()).resolves.toBe("collaborator");
    expect(rpc).toHaveBeenCalledWith("current_app_role");
  });
  it.each([null, "superadmin", { role: "admin" }])(
    "rejects missing or malformed role responses: %s",
    async (value) => {
      rpc.mockResolvedValue({ data: value, error: null });
      await expect(getMyRole()).rejects.toThrow("consultar seu perfil");
    },
  );
  it("does not silently grant access after a backend error", async () => {
    rpc.mockResolvedValue({ data: "admin", error: { code: "42501" } });
    await expect(getMyRole()).rejects.toThrow("consultar seu perfil");
  });
  it("requests a role change through the protected database function", async () => {
    const profile = {
      user_id: "user-b",
      role: "collaborator",
      created_at: "2026-11-04T12:00:00Z",
      updated_at: "2026-11-04T12:01:00Z",
    };
    rpc.mockResolvedValue({ data: profile, error: null });
    await expect(changeUserRole("user-b", "collaborator")).resolves.toEqual(profile);
    expect(rpc).toHaveBeenCalledWith("set_user_role", {
      p_user_id: "user-b",
      p_role: "collaborator",
    });
  });
  it("reports denied administrator access", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(changeUserRole("user-b", "admin")).rejects.toThrow("Somente administradores");
  });
  it("reports the last-administrator restriction", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    await expect(changeUserRole("user-a", "client")).rejects.toThrow("pelo menos um administrador");
  });
  it("does not confirm an unexpected role change result", async () => {
    rpc.mockResolvedValue({ data: { user_id: "user-c", role: "admin" }, error: null });
    await expect(changeUserRole("user-b", "collaborator")).rejects.toThrow("confirmar a alteração");
  });
  it("rejects unsupported roles before sending them", async () => {
    await expect(changeUserRole("user-b", "owner" as AppRole)).rejects.toThrow("inválido");
    expect(rpc).not.toHaveBeenCalled();
  });
});

import { listAdminUsers } from "@/lib/user-profiles";
describe("Administrator listing API", () => {
  it("passes trimmed search, role and pagination to the protected function", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(listAdminUsers(" teste ", "collaborator", 2)).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith("admin_list_users", {
      p_search: "teste",
      p_role: "collaborator",
      p_limit: 20,
      p_offset: 40,
    });
  });
  it("reports permission failures rather than exposing cached data", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(listAdminUsers("", null, 0)).rejects.toThrow("não permite consultar");
  });
});
