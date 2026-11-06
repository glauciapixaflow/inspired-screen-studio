import { createFileRoute } from "@tanstack/react-router";
import { TeamReservationsPage } from "@/components/admin/TeamReservationsPage";

export const Route = createFileRoute("/atendimento")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atendimento — Red Planet Properties" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TeamReservationsPage,
});
