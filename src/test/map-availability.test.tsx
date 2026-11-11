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
    fireEvent.click(await screen.findByRole("button", { name: "Lote A1: Reservado" }));
    expect(screen.getByRole("status")).toHaveTextContent("reservada por outra conta");
    expect(screen.getByRole("button", { name: "Solicitar reserva desta área" })).toBeDisabled();
    expect(reserve).not.toHaveBeenCalled();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
  it("distinguishes confirmed parcels and leaves free parcels selectable", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Lote A2: Confirmado" }));
    expect(screen.getByRole("status")).toHaveTextContent("já foi confirmada");
    fireEvent.click(screen.getByRole("button", { name: "Lote A3: Disponível" }));
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
    expect(screen.queryByRole("button", { name: /Lote A1/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lotes disponíveis por região")).not.toBeInTheDocument();
    expect(screen.queryByText("16 lotes disponíveis")).not.toBeInTheDocument();
  });
  it("counts available land lots independently for each region", async () => {
    show();
    expect(await screen.findByText("14 lotes disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Elysium: 14 de 16 lotes disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Olympus: 16 de 16 lotes disponíveis")).toBeInTheDocument();
    expect(
      screen.getByText(/16 lotes de terra no total · 1 reservados · 1 confirmados/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lotes da região").querySelectorAll("button")).toHaveLength(16);
  });
  it("does not show available counts before the lookup finishes", () => {
    availability.mockReturnValue({
      user: { id: "other-user" },
      loading: false,
      error: false,
      query: { isPending: true, isError: false },
      parcels: [],
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Consultando lotes disponíveis");
    expect(screen.queryByLabelText("Lotes disponíveis por região")).not.toBeInTheDocument();
    expect(screen.queryByText("16 lotes disponíveis")).not.toBeInTheDocument();
  });
});
