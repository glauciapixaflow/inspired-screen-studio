import { createFileRoute } from "@tanstack/react-router";
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração — Red Planet Properties" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AdminPasswordGate>
      <AdminUsersPage />
    </AdminPasswordGate>
  ),
});
