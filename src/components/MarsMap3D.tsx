import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useParcelAvailability } from "@/hooks/use-parcel-availability";
import type { ParcelAvailability } from "@/lib/parcel-availability";
import { regionLotAvailability } from "@/lib/parcel-availability";
import FuturisticHouse, { sceneColor } from "@/components/FuturisticHouse";
import HousePrinter3D from "@/components/HousePrinter3D";
import Subdivision3D from "@/components/Subdivision3D";
import { ReservationPanel } from "@/components/ReservationPanel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOTES, LOT_ROWS, type Lote } from "@/lib/mars-regions";
import {
  completeConstruction,
  parcelOffset,
  reserveConstructionSite,
  type ConstructionSite,
} from "@/lib/construction";

// Feel constants
const RADIUS = 2;
const FLY_ALT = 0.35;
const FLY_SPEED = 0.18; // rad/s along the surface
const TURN = 1.2; // rad/s heading change

function latLon(lat: number, lon: number, r: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(th),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(th),
  );
}

// Procedural Mars texture (value noise on canvas)
function makeMarsTexture() {
  const w = 1024,
    h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const img = ctx.createImageData(w, h);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const G = 64,
    grid = Array.from({ length: G * G }, rnd);
  const n = (x: number, y: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const g = (a: number, b: number) => grid[(((b % G) + G) % G) * G + (((a % G) + G) % G)] ?? 0;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    return (
      (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) +
      (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v
    );
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let f = 0,
        amp = 0.5,
        fr = ((4 / w) * G) / 4;
      for (let o = 0; o < 6; o++) {
        f += amp * n(x * fr * 4, y * fr * 4);
        amp *= 0.5;
        fr *= 2;
      }
      const lat = Math.abs(y / h - 0.5) * 2;
      const ice = lat > 0.88 ? (lat - 0.88) * 8 : 0;
      const i = (y * w + x) * 4;
      const d = f * 1.3;
      img.data[i] = Math.min(255, 120 + d * 120 + ice * 200);
      img.data[i + 1] = Math.min(255, 50 + d * 60 + ice * 220);
      img.data[i + 2] = Math.min(255, 30 + d * 30 + ice * 230);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Planet() {
  const tex = useMemo(makeMarsTexture, []);
  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 128, 128]} />
      <meshStandardMaterial map={tex} bumpMap={tex} bumpScale={0.04} roughness={1} />
    </mesh>
  );
}

function Markers({
  onPick,
  hidden,
  availability,
  availabilityKnown,
}: {
  onPick: (l: Lote) => void;
  hidden: boolean;
  availability: ParcelAvailability[];
  availabilityKnown: boolean;
}) {
  const colors = useMemo(
    () => ({ reserved: sceneColor("--map-reserved"), free: sceneColor("--map-selected") }),
    [],
  );
  return (
    <>
      {LOTES.map((l) => {
        const p = latLon(l.lat, l.lon, RADIUS * 1.01);
        const occupied = availability.filter((row) => row.region_id === l.id).length;
        return (
          <group key={l.id} position={p} visible={!hidden}>
            <mesh onClick={() => onPick(l)}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial color={occupied ? colors.reserved : colors.free} />
            </mesh>
            <Html
              distanceFactor={6}
              center
              wrapperClass={hidden ? "hidden" : ""}
              style={{ display: hidden ? "none" : undefined }}
            >
              <span
                onClick={() => onPick(l)}
                className="cursor-pointer whitespace-nowrap rounded-full bg-ink/90 px-3 py-1 text-xs font-semibold tracking-widest text-ink-foreground"
              >
                {l.id} · {l.nome.toUpperCase()}
                {availabilityKnown &&
                  ` · ${regionLotAvailability(l.id, availability).available} lotes disponíveis`}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

type FlyState = { pos: THREE.Vector3; dir: THREE.Vector3; turn: number };

function Flight({ active, fly }: { active: boolean; fly: React.MutableRefObject<FlyState> }) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!active) return;
    const dt = Math.min(delta, 0.05);
    const f = fly.current;
    const up = f.pos.clone().normalize();
    f.dir.applyAxisAngle(up, f.turn * TURN * dt);
    const axis = new THREE.Vector3().crossVectors(up, f.dir).normalize();
    f.pos.applyAxisAngle(axis, FLY_SPEED * dt);
    f.dir
      .applyAxisAngle(axis, FLY_SPEED * dt)
      .projectOnPlane(f.pos.clone().normalize())
      .normalize();
    const n = f.pos.clone().normalize();
    camera.position.copy(n.clone().multiplyScalar(RADIUS + FLY_ALT));
    camera.up.copy(n);
    camera.lookAt(n.clone().multiplyScalar(RADIUS).add(f.dir.clone().multiplyScalar(0.9)));
  });
  return null;
}

export default function MarsMap3D({ initialRegion }: { initialRegion?: string | undefined }) {
  const availability = useParcelAvailability();
  const availabilityKnown =
    !!availability.user &&
    !availability.loading &&
    !availability.error &&
    !availability.query.isPending &&
    !availability.query.isError;
  const [mode, setMode] = useState<"orbita" | "voo">("orbita");
  const [picked, setPicked] = useState<Lote | null>(null);
  const [plot, setPlot] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Lote | null>(null);
  const [zoomTo, setZoomTo] = useState<THREE.Vector3 | null>(null);
  const [construction, setConstruction] = useState<ConstructionSite | null>(null);
  const [subdivision, setSubdivision] = useState<ConstructionSite | null>(null);
  const [completedHomes, setCompletedHomes] = useState<ConstructionSite[]>([]);
  const onComplete = useCallback(
    (site: ConstructionSite) => setCompletedHomes((sites) => completeConstruction(sites, site, 1)),
    [],
  );
  const controls = useRef<OrbitControlsImpl | null>(null);
  const fly = useRef<FlyState>({
    pos: latLon(0, 0, RADIUS),
    dir: new THREE.Vector3(0, 1, 0),
    turn: 0,
  });

  useEffect(() => {
    const region = LOTES.find((region) => region.id === initialRegion);
    if (!region) return;
    setPicked(region);
    setPlot(null);
    setMode("orbita");
    setZoomed(region);
    setZoomTo(latLon(region.lat, region.lon, RADIUS + 0.22));
  }, [initialRegion]);

  const startFlight = (l?: Lote) => {
    const p = latLon(l?.lat ?? 0, (l?.lon ?? 0) - 25, RADIUS);
    const n = p.clone().normalize();
    fly.current.pos = p;
    fly.current.dir = new THREE.Vector3(0, 1, 0)
      .projectOnPlane(n)
      .normalize()
      .applyAxisAngle(n, -Math.PI / 2);
    setMode("voo");
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") fly.current.turn = 1;
      if (e.key === "ArrowRight" || e.key === "d") fly.current.turn = -1;
    };
    const up = () => (fly.current.turn = 0);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const hold = (v: number) => ({
    onPointerDown: () => (fly.current.turn = v),
    onPointerUp: () => (fly.current.turn = 0),
    onPointerLeave: () => (fly.current.turn = 0),
  });

  return (
    <div className="relative h-full w-full bg-ink">
      <Canvas
        camera={{ position: [0, 1, 6], fov: 50 }}
        onCreated={(s) =>
          s.gl.domElement.parentElement?.parentElement?.setAttribute("data-scene-ready", "")
        }
      >
        <color attach="background" args={["#0d0a08"]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 3, 5]} intensity={2.2} />
        <Stars radius={60} depth={30} count={3000} factor={3} fade />
        <Planet />
        <Markers
          availability={availability.parcels}
          availabilityKnown={availabilityKnown}
          hidden={!!zoomed}
          onPick={(l) => {
            setPicked(l);
            setPlot(null);
          }}
        />
        {mode === "orbita" && (
          <OrbitControls
            ref={controls}
            enablePan={false}
            minDistance={2.12}
            maxDistance={10}
            zoomSpeed={0.6}
          />
        )}
        <Zoomer target={zoomTo} controls={controls} onDone={() => setZoomTo(null)} />
        {zoomed && (
          <Plots
            lote={zoomed}
            selected={plot}
            onSelect={setPlot}
            homes={completedHomes}
            availability={availability.parcels}
          />
        )}
        <Flight active={mode === "voo"} fly={fly} />
      </Canvas>

      <div className="absolute left-6 top-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setMode("orbita");
            setZoomed(null);
            setZoomTo(new THREE.Vector3(0, 1, 6));
          }}
          className={`px-5 py-3 text-sm font-semibold ${mode === "orbita" ? "bg-lime text-lime-foreground" : "bg-ink/80 text-ink-foreground"}`}
        >
          Órbita
        </button>
        <button
          onClick={() => {
            setZoomed(null);
            startFlight(picked ?? undefined);
          }}
          className={`px-5 py-3 text-sm font-semibold ${mode === "voo" ? "bg-lime text-lime-foreground" : "bg-ink/80 text-ink-foreground"}`}
        >
          Voar sobre Marte
        </button>
      </div>

      <div className="absolute left-6 top-20 w-56 sm:w-64">
        <Select
          value={picked?.id ?? ""}
          onValueChange={(id) => {
            const region = LOTES.find((lote) => lote.id === id);
            if (!region) return;
            setPicked(region);
            setPlot(null);
            setMode("orbita");
            setZoomed(region);
            setZoomTo(latLon(region.lat, region.lon, RADIUS + 0.22));
          }}
        >
          <SelectTrigger
            aria-label="Escolher região de Marte"
            className="w-full border-ink-foreground/30 bg-ink text-ink-foreground"
          >
            <SelectValue placeholder="Escolher região" />
          </SelectTrigger>
          <SelectContent>
            {LOTES.map((region) => (
              <SelectItem key={region.id} value={region.id}>
                {region.nome}
                {availabilityKnown &&
                  ` · ${regionLotAvailability(region.id, availability.parcels).available} lotes disponíveis`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={`absolute bottom-20 left-6 max-w-56 sm:bottom-auto sm:top-36 space-y-2 bg-ink/90 p-3 text-xs text-ink-foreground ${picked ? "hidden sm:block" : ""}`}
        aria-label="Disponibilidade de lotes por região"
      >
        <p className="font-semibold">Lotes de terra por região</p>
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 bg-map-free" /> Lote disponível
        </p>
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 bg-map-reserved" /> Lote reservado
        </p>
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 bg-map-confirmed" /> Lote confirmado pela equipe
        </p>
        {availability.loading || (!!availability.user && availability.query.isPending) ? (
          <p role="status">Consultando lotes disponíveis...</p>
        ) : !availability.user ? (
          <p>Entre na conta para consultar os lotes disponíveis por região.</p>
        ) : availability.query.isError || availability.error ? (
          <>
            <p role="alert">Disponibilidade indisponível.</p>
            <button className="underline" onClick={() => void availability.query.refetch()}>
              Atualizar disponibilidade
            </button>
          </>
        ) : (
          <>
            <ul
              className="max-h-[25vh] space-y-1 overflow-y-auto"
              aria-label="Lotes disponíveis por região"
            >
              {LOTES.map((region) => {
                const counts = regionLotAvailability(region.id, availability.parcels);
                return (
                  <li key={region.id}>
                    {region.nome}: {counts.available} de {counts.total} lotes disponíveis
                  </li>
                );
              })}
            </ul>
            <p>Atualização a cada 15 segundos.</p>
          </>
        )}
      </div>
      {mode === "voo" && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-ink-foreground">
          <button {...hold(1)} className="bg-ink/80 px-6 py-4 font-semibold">
            ◀ Esquerda
          </button>
          <span className="text-xs tracking-[0.2em] opacity-70">SETAS ← → PARA PILOTAR</span>
          <button {...hold(-1)} className="bg-ink/80 px-6 py-4 font-semibold">
            Direita ▶
          </button>
        </div>
      )}

      {zoomed && mode === "orbita" && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-ink/80 px-5 py-3 text-xs tracking-[0.2em] text-ink-foreground">
          CLIQUE EM UM LOTE PARA ESCOLHER
        </p>
      )}

      {picked && (
        <div
          className={`absolute right-4 max-h-[calc(100dvh-10rem)] overflow-y-auto w-64 bg-background p-4 text-foreground sm:right-6 sm:top-6 sm:w-72 sm:p-6 ${completedHomes.some((home) => home.region === picked.nome && home.parcel === plot) ? "bottom-20 sm:bottom-auto" : "top-32"}`}
        >
          <p className="eyebrow text-muted-foreground">Região {picked.id}</p>
          <h3 className="mt-3 text-2xl">{picked.nome}</h3>
          {availabilityKnown &&
            (() => {
              const counts = regionLotAvailability(picked.id, availability.parcels);
              return (
                <div
                  className="mt-3 rounded-md border border-border p-3"
                  aria-label={`Disponibilidade de lotes em ${picked.nome}`}
                >
                  <p className="text-lg font-semibold">{counts.available} lotes disponíveis</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {counts.total} lotes de terra no total · {counts.reserved} reservados ·{" "}
                    {counts.confirmed} confirmados
                  </p>
                </div>
              );
            })()}
          <p className="mt-2 text-sm text-muted-foreground">
            {picked.preco ? (
              <>
                A partir de <b className="text-foreground">{picked.preco}</b>
              </>
            ) : (
              "Valor a definir"
            )}
          </p>
          {availabilityKnown && (
            <div className="mt-4 grid grid-cols-4 gap-1" aria-label="Lotes da região">
              {ROWS.flatMap((r) =>
                [1, 2, 3, 4].map((c) => {
                  const id = `${r}${c}`;
                  const occupied = availability.parcels.find(
                    (row) => row.region_id === picked.id && row.parcel_id === id,
                  );
                  const label =
                    occupied?.status === "confirmed"
                      ? "Confirmado"
                      : occupied
                        ? "Reservado"
                        : "Disponível";
                  return (
                    <button
                      key={id}
                      aria-label={`Lote ${id}: ${label}`}
                      aria-pressed={plot === id}
                      onClick={() => setPlot(id)}
                      className={`border border-border p-2 text-xs ${occupied?.status === "confirmed" ? "bg-map-confirmed text-ink" : occupied ? "bg-map-reserved text-ink" : "bg-background"} ${plot === id ? "ring-2 ring-foreground" : ""}`}
                    >
                      <span className="block font-semibold">{id}</span>
                      <span className="text-[9px]">{label}</span>
                    </button>
                  );
                }),
              )}
            </div>
          )}
          {plot ? (
            <div className="mt-5 border-t border-border pt-5">
              <p className="eyebrow text-muted-foreground">Lote escolhido</p>
              <p className="mt-2 text-xl">
                {picked.nome} · {plot}
              </p>
              <p className="text-sm text-muted-foreground">2.400 m²</p>
              <ReservationPanel
                key={`${picked.id}-${plot}`}
                regionId={picked.id}
                parcelId={plot}
                occupied={availability.parcels.find(
                  (row) => row.region_id === picked.id && row.parcel_id === plot,
                )}
                availabilityPending={
                  availability.loading || (!!availability.user && availability.query.isPending)
                }
                availabilityError={
                  availability.error || (!!availability.user && availability.query.isError)
                }
              />
              <Button
                variant="outline"
                onClick={() => setConstruction(reserveConstructionSite(picked.nome, plot))}
                className="mt-4 h-auto w-full py-3 font-semibold"
              >
                {completedHomes.some((home) => home.region === picked.nome && home.parcel === plot)
                  ? "Ver simulação da minha casa"
                  : "Simular construção 3D"}
              </Button>
              {completedHomes.some(
                (home) => home.region === picked.nome && home.parcel === plot,
              ) && (
                <>
                  <p className="mt-2 text-sm font-semibold text-primary">Casa concluída no lote</p>
                  <Button
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() => setSubdivision(reserveConstructionSite(picked.nome, plot))}
                  >
                    Ver loteamento 3D
                  </Button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setMode("orbita");
                setZoomed(picked);
                setZoomTo(latLon(picked.lat, picked.lon, RADIUS + 0.22));
              }}
              className="mt-5 w-full bg-primary py-3 font-semibold text-primary-foreground"
            >
              Aproximar e escolher lote
            </button>
          )}
          <button
            onClick={() => {
              setZoomed(null);
              startFlight(picked);
            }}
            className="mt-2 w-full border border-foreground/40 py-3 font-semibold"
          >
            Voar até aqui
          </button>
          <button
            onClick={() => {
              setPicked(null);
              setPlot(null);
            }}
            className="mt-2 w-full py-2 text-sm text-muted-foreground"
          >
            Fechar
          </button>
        </div>
      )}
      {construction && !subdivision && (
        <HousePrinter3D
          site={construction}
          homes={completedHomes}
          initialComplete={completedHomes.some(
            (home) => home.region === construction.region && home.parcel === construction.parcel,
          )}
          onComplete={onComplete}
          onSubdivision={() => {
            setSubdivision(construction);
            setConstruction(null);
          }}
          onBack={() => setConstruction(null)}
        />
      )}
      {subdivision && (
        <Subdivision3D
          site={subdivision}
          homes={completedHomes}
          onBack={() => setSubdivision(null)}
        />
      )}
    </div>
  );
}

// Smoothly moves the orbit camera to a target position
function Zoomer({
  target,
  controls,
  onDone,
}: {
  target: THREE.Vector3 | null;
  controls: React.RefObject<OrbitControlsImpl | null>;
  onDone: () => void;
}) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!target) return;
    camera.up.set(0, 1, 0);
    camera.position.lerp(target, 1 - Math.exp(-4 * Math.min(delta, 0.05)));
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    if (camera.position.distanceTo(target) < 0.005) onDone();
  });
  return null;
}

const ROWS = LOT_ROWS;
// Grid of purchasable parcels on the surface around a region
function Plots({
  lote,
  selected,
  onSelect,
  homes,
  availability,
}: {
  lote: Lote;
  selected: string | null;
  onSelect: (p: string) => void;
  homes: ConstructionSite[];
  availability: ParcelAvailability[];
}) {
  const colors = useMemo(
    () => ({
      reserved: sceneColor("--map-reserved"),
      confirmed: sceneColor("--map-confirmed"),
      free: sceneColor("--map-free"),
      selected: sceneColor("--map-selected"),
    }),
    [],
  );
  const { pos, quat } = useMemo(() => {
    const p = latLon(lote.lat, lote.lon, RADIUS * 1.002);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      p.clone().normalize(),
    );
    return { pos: p, quat: q };
  }, [lote]);
  const S = 0.028;
  return (
    <group position={pos} quaternion={quat}>
      {homes
        .filter((home) => home.region === lote.nome)
        .map((home) => {
          const [x, y] = parcelOffset(home.parcel);
          return (
            <group
              key={home.parcel}
              position={[x, y, 0.0005]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={0.0034}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(home.parcel);
              }}
            >
              <FuturisticHouse />
            </group>
          );
        })}
      {ROWS.flatMap((r, i) =>
        [1, 2, 3, 4].map((c, j) => {
          const id = `${r}${c}`;
          const on = selected === id;
          const occupied = availability.find(
            (row) => row.region_id === lote.id && row.parcel_id === id,
          );
          return (
            <mesh
              key={id}
              position={[(j - 1.5) * S * 1.15, (i - 1.5) * S * 1.15, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(id);
              }}
            >
              <planeGeometry args={[on ? S * 1.08 : S, on ? S * 1.08 : S]} />
              <meshBasicMaterial
                color={
                  occupied?.status === "confirmed"
                    ? colors.confirmed
                    : occupied
                      ? colors.reserved
                      : on
                        ? colors.selected
                        : colors.free
                }
                transparent
                opacity={occupied || on ? 0.95 : 0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}
