import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { availability, own, reserve } = vi.hoisted(() => ({
  availability: vi.fn(),
  own: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("@/hooks/use-parcel-availability", () => ({ useParcelAvailability: availability }));
vi.mock("@/hooks/use-reservations", () => ({ useReservations: own }));
vi.mock("@/lib/reservations", async (original) => ({
  ...(await original<typeof import("@/lib/reservations")>()),
  reserveArea: reserve,
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="map-canvas" />,
  useFrame: vi.fn(),
  useThree: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
import MarsMap3D from "@/components/MarsMap3D";
const rows = [
  { region_id: "08", parcel_id: "A1", status: "reserved", available_until: "2099-01-01T00:00:00Z" },
  { region_id: "08", parcel_id: "A2", status: "confirmed", available_until: null },
];
function show() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MarsMap3D initialRegion="08" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  availability.mockReturnValue({
    user: { id: "other-user" },
    loading: false,
    error: false,
    query: { isPending: false, isError: false },
    parcels: rows,
  });
  own.mockReturnValue({
    user: { id: "other-user" },
    loading: false,
    error: false,
    query: { data: [], isPending: false, isError: false },
  });
});
afterEach(cleanup);
describe("Map shared availability", () => {
  it("identifies occupied parcels to a different account and prevents another reservation", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Parcela A1: Reservada" }));
    expect(screen.getByRole("status")).toHaveTextContent("reservada por outra conta");
    expect(screen.getByRole("button", { name: "Solicitar reserva desta área" })).toBeDisabled();
    expect(reserve).not.toHaveBeenCalled();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
  it("distinguishes confirmed parcels and leaves free parcels selectable", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Parcela A2: Confirmada" }));
    expect(screen.getByRole("status")).toHaveTextContent("já foi confirmada");
    fireEvent.click(screen.getByRole("button", { name: "Parcela A3: Livre" }));
    expect(screen.getByRole("button", { name: "Solicitar reserva desta área" })).toBeEnabled();
  });
  it("does not describe unknown availability as free when lookup fails", async () => {
    availability.mockReturnValue({
      user: { id: "other-user" },
      loading: false,
      error: false,
      query: { isPending: false, isError: true, refetch: vi.fn() },
      parcels: [],
    });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Disponibilidade indisponível");
    expect(screen.queryByRole("button", { name: /Parcela A1/ })).not.toBeInTheDocument();
  });
});
