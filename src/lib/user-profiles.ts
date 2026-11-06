export type AppRole = "client" | "collaborator" | "admin";
export type UserProfile = {
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};
export const ROLE_LABELS: Record<AppRole, string> = {
  client: "Cliente",
  collaborator: "Colaborador",
  admin: "Administrador",
};

function isAppRole(value: unknown): value is AppRole {
  return value === "client" || value === "collaborator" || value === "admin";
}

export async function getMyRole(): Promise<AppRole> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("current_app_role");
  if (error || !isAppRole(data)) {
    throw new Error("Não foi possível consultar seu perfil de acesso.");
  }
  return data;
}

export async function changeUserRole(userId: string, role: AppRole): Promise<UserProfile> {
  if (!isAppRole(role)) throw new Error("Perfil de acesso inválido.");
  const { supabase } = await import("@/lib/supabase");
  // Permissions and the last-administrator check are enforced by the database.
  const { data, error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) {
    if (error.code === "42501") throw new Error("Somente administradores podem alterar os perfis.");
    if (error.code === "23514") throw new Error("É necessário manter pelo menos um administrador.");
    if (error.code === "P0002") throw new Error("Usuário não encontrado.");
    throw new Error("Não foi possível alterar o perfil. Tente novamente.");
  }
  if (!data || !isAppRole(data.role) || data.user_id !== userId || data.role !== role) {
    throw new Error("Não foi possível confirmar a alteração do perfil.");
  }
  return data as UserProfile;
}

export type AdminUser = UserProfile & { email: string | null; total_count: number };
export const ADMIN_PAGE_SIZE = 20;

export async function listAdminUsers(
  search: string,
  role: AppRole | null,
  page: number,
): Promise<AdminUser[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search.trim(),
    p_role: role,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: page * ADMIN_PAGE_SIZE,
  });
  if (error) {
    if (error.code === "42501") throw new Error("Seu perfil não permite consultar os usuários.");
    throw new Error("Não foi possível carregar os usuários. Tente novamente.");
  }
  if (!Array.isArray(data))
    throw new Error("Não foi possível carregar os usuários. Tente novamente.");
  return data as AdminUser[];
}
