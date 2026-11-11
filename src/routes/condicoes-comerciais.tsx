import { createFileRoute } from "@tanstack/react-router";
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";
import { CommercialTermsPage } from "@/components/admin/CommercialTermsPage";
export const Route = createFileRoute("/condicoes-comerciais")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Condições comerciais — Red Planet Properties" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AdminPasswordGate>
      <CommercialTermsPage />
    </AdminPasswordGate>
  ),
});
