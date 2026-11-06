import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useReservationsMock, reserveAreaMock } = vi.hoisted(() => ({
  useReservationsMock: vi.fn(),
  reserveAreaMock: vi.fn(),
}));
vi.mock("@/hooks/use-reservations", () => ({ useReservations: useReservationsMock }));
vi.mock("@/lib/reservations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reservations")>()),
  reserveArea: reserveAreaMock,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
import { ReservationPanel } from "@/components/ReservationPanel";
import { MyReservations } from "@/components/MyReservations";
const row = {
  id: "protocol-a",
  user_id: "user-a",
  region_id: "08",
  parcel_id: "A1",
  status: "pending_contact",
  created_at: "2026-11-04T12:00:00Z",
  expires_at: "2026-11-09T12:00:00Z",
  contacted_at: null,
};
function show(children: ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-04T12:00:00Z"));
  useReservationsMock.mockReturnValue({
    user: { id: "user-a" },
    loading: false,
    error: false,
    query: { data: [], isPending: false, isError: false },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("Reservation UI", () => {
  it("requires login for visitors", () => {
    useReservationsMock.mockReturnValue({ user: null, loading: false, error: false, query: {} });
    show(<ReservationPanel regionId="08" parcelId="A1" />);
    expect(screen.getByRole("link", { name: "Entrar para reservar" })).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("button", { name: "Solicitar reserva desta área" }),
    ).not.toBeInTheDocument();
    expect(reserveAreaMock).not.toHaveBeenCalled();
  });
  it("shows a protocol only after saving", async () => {
    let finish!: (value: unknown) => void;
    reserveAreaMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show(<ReservationPanel regionId="08" parcelId="A1" />);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar reserva desta área" }));
    expect(await screen.findByRole("button", { name: "Salvando reserva..." })).toBeDisabled();
    expect(screen.queryByText("Solicitação de reserva salva")).not.toBeInTheDocument();
    finish(row);
    expect(await screen.findByText("Solicitação de reserva salva")).toBeInTheDocument();
    expect(screen.getByText("protocol-a")).toBeInTheDocument();
  });
  it("does not show a successful reservation on failure", async () => {
    reserveAreaMock.mockRejectedValue(new Error("Não foi possível salvar sua reserva."));
    show(<ReservationPanel regionId="08" parcelId="A1" />);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar reserva desta área" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar");
    expect(screen.queryByText("Solicitação de reserva salva")).not.toBeInTheDocument();
  });
  it("shows saved reservations after reloading data", () => {
    useReservationsMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      error: false,
      query: { data: [row], isPending: false, isError: false },
    });
    show(<MyReservations />);
    expect(screen.getByText("Elysium · Parcela A1")).toBeInTheDocument();
    expect(screen.getByText("protocol-a")).toBeInTheDocument();
    expect(screen.getByText("Aguardando contato")).toBeInTheDocument();
  });
});

describe("Reservation deadline UI", () => {
  it("shows expired history without blocking a new request", () => {
    useReservationsMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      error: false,
      query: { data: [{ ...row, status: "expired" }], isPending: false, isError: false },
    });
    show(
      <>
        <ReservationPanel regionId="08" parcelId="A1" />
        <MyReservations />
      </>,
    );
    expect(screen.getByText("Reserva expirada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar reserva desta área" })).toBeEnabled();
  });
  it("shows the exact deadline in Brasilia time", () => {
    useReservationsMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      error: false,
      query: { data: [row], isPending: false, isError: false },
    });
    show(<ReservationPanel regionId="08" parcelId="A1" />);
    expect(screen.getByText(/09\/11\/2026.*09:00/)).toBeInTheDocument();
  });
  it("expires an open panel at the deadline without requiring a reload", () => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T11:59:59Z"));
    useReservationsMock.mockReturnValue({
      user: { id: "user-a" },
      loading: false,
      error: false,
      query: { data: [row], isPending: false, isError: false },
    });
    show(<ReservationPanel regionId="08" parcelId="A1" />);
    expect(screen.getByText("Solicitação de reserva salva")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText("Solicitação de reserva salva")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar reserva desta área" })).toBeEnabled();
  });
});

describe("Cancellation eligibility", () => {
  it.each(["pending_contact", "contacted"])(
    "offers cancellation before conclusion: %s",
    (status) => {
      useReservationsMock.mockReturnValue({
        user: { id: "user-a" },
        loading: false,
        error: false,
        query: {
          data: [{ ...row, status, contacted_at: status === "contacted" ? row.created_at : null }],
          isPending: false,
          isError: false,
        },
      });
      show(<MyReservations />);
      expect(screen.getByRole("button", { name: "Cancelar minha reserva" })).toBeEnabled();
    },
  );
  it.each(["confirmed", "cancelled", "expired", "deactivated"])(
    "does not offer cancellation on a closed reservation: %s",
    (status) => {
      useReservationsMock.mockReturnValue({
        user: { id: "user-a" },
        loading: false,
        error: false,
        query: { data: [{ ...row, status }], isPending: false, isError: false },
      });
      show(<MyReservations />);
      expect(
        screen.queryByRole("button", { name: "Cancelar minha reserva" }),
      ).not.toBeInTheDocument();
    },
  );
});
