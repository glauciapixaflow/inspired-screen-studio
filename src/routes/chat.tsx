import { createFileRoute } from "@tanstack/react-router";
import { ReservationChatPage } from "@/components/ReservationChatPage";
export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { reservation?: string } =>
    typeof search["reservation"] === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search["reservation"])
      ? { reservation: search["reservation"] }
      : {},
  head: () => ({
    meta: [{ title: "Conversas — Red Planet Properties" }, { name: "robots", content: "noindex" }],
  }),
  component: Chat,
});
function Chat() {
  const { reservation } = Route.useSearch();
  return <ReservationChatPage reservationId={reservation} />;
}
