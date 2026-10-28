import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// Feel constants
const RADIUS = 2;
const FLY_ALT = 0.35;
const FLY_SPEED = 0.18; // rad/s along the surface
const TURN = 1.2; // rad/s heading change

export type Lote = { id: string; nome: string; lat: number; lon: number; preco: string };
export const LOTES: Lote[] = [
  { id: "08", nome: "Elysium", lat: 18.6, lon: 146, preco: "R$ 189 mil" },
  { id: "12", nome: "Olympus", lat: 18.4, lon: -134, preco: "R$ 312 mil" },
  { id: "21", nome: "Valles", lat: -12, lon: -70, preco: "R$ 247 mil" },
];

function latLon(lat: number, lon: number, r: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

// Procedural Mars texture (value noise on canvas)
function makeMarsTexture() {
  const w = 1024, h = 512;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const G = 64, grid = Array.from({ length: G * G }, rnd);
  const n = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const g = (a: number, b: number) => grid[((b % G) + G) % G * G + (((a % G) + G) % G)] ?? 0;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let f = 0, amp = 0.5, fr = 4 / w * G / 4;
    for (let o = 0; o < 6; o++) { f += amp * n(x * fr * 4, y * fr * 4); amp *= 0.5; fr *= 2; }
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

function Markers({ onPick }: { onPick: (l: Lote) => void }) {
  return (
    <>
      {LOTES.map((l) => {
        const p = latLon(l.lat, l.lon, RADIUS * 1.01);
        return (
          <group key={l.id} position={p}>
            <mesh onClick={() => onPick(l)}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial color="#c8f040" />
            </mesh>
            <Html distanceFactor={6} center>
              <span onClick={() => onPick(l)} className="cursor-pointer whitespace-nowrap rounded-full bg-ink/90 px-3 py-1 text-xs font-semibold tracking-widest text-ink-foreground">
                {l.id} · {l.nome.toUpperCase()}
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
    f.dir.applyAxisAngle(axis, FLY_SPEED * dt).projectOnPlane(f.pos.clone().normalize()).normalize();
    const n = f.pos.clone().normalize();
    camera.position.copy(n.clone().multiplyScalar(RADIUS + FLY_ALT));
    camera.up.copy(n);
    camera.lookAt(n.clone().multiplyScalar(RADIUS).add(f.dir.clone().multiplyScalar(0.9)));
  });
  return null;
}

export default function MarsMap3D() {
  const [mode, setMode] = useState<"orbita" | "voo">("orbita");
  const [picked, setPicked] = useState<Lote | null>(null);
  const [plot, setPlot] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<Lote | null>(null);
  const [zoomTo, setZoomTo] = useState<THREE.Vector3 | null>(null);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const fly = useRef<FlyState>({ pos: latLon(0, 0, RADIUS), dir: new THREE.Vector3(0, 1, 0), turn: 0 });

  const startFlight = (l?: Lote) => {
    const p = latLon(l?.lat ?? 0, (l?.lon ?? 0) - 25, RADIUS);
    const n = p.clone().normalize();
    fly.current.pos = p;
    fly.current.dir = new THREE.Vector3(0, 1, 0).projectOnPlane(n).normalize().applyAxisAngle(n, -Math.PI / 2);
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
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const hold = (v: number) => ({
    onPointerDown: () => (fly.current.turn = v),
    onPointerUp: () => (fly.current.turn = 0),
    onPointerLeave: () => (fly.current.turn = 0),
  });

  return (
    <div className="relative h-full w-full bg-ink">
      <Canvas camera={{ position: [0, 1, 6], fov: 50 }} onCreated={(s) => s.gl.domElement.parentElement?.parentElement?.setAttribute("data-scene-ready", "")}>
        <color attach="background" args={["#0d0a08"]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 3, 5]} intensity={2.2} />
        <Stars radius={60} depth={30} count={3000} factor={3} fade />
        <Planet />
        <Markers onPick={(l) => { setPicked(l); setPlot(null); }} />
        {mode === "orbita" && <OrbitControls ref={controls} enablePan={false} minDistance={2.12} maxDistance={10} zoomSpeed={0.6} />}
        <Zoomer target={zoomTo} controls={controls} onDone={() => setZoomTo(null)} />
        {zoomed && <Plots lote={zoomed} selected={plot} onSelect={setPlot} />}
        <Flight active={mode === "voo"} fly={fly} />
      </Canvas>

      <div className="absolute left-6 top-6 flex gap-2">
        <button onClick={() => { setMode("orbita"); setZoomed(null); setZoomTo(new THREE.Vector3(0, 1, 6)); }} className={`px-5 py-3 text-sm font-semibold ${mode === "orbita" ? "bg-lime text-lime-foreground" : "bg-ink/80 text-ink-foreground"}`}>Órbita</button>
        <button onClick={() => { setZoomed(null); startFlight(picked ?? undefined); }} className={`px-5 py-3 text-sm font-semibold ${mode === "voo" ? "bg-lime text-lime-foreground" : "bg-ink/80 text-ink-foreground"}`}>Voar sobre Marte</button>
      </div>

      {mode === "voo" && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-ink-foreground">
          <button {...hold(1)} className="bg-ink/80 px-6 py-4 font-semibold">◀ Esquerda</button>
          <span className="text-xs tracking-[0.2em] opacity-70">SETAS ← → PARA PILOTAR</span>
          <button {...hold(-1)} className="bg-ink/80 px-6 py-4 font-semibold">Direita ▶</button>
        </div>
      )}

      {zoomed && mode === "orbita" && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-ink/80 px-5 py-3 text-xs tracking-[0.2em] text-ink-foreground">CLIQUE EM UMA PARCELA PARA ESCOLHER</p>
      )}

      {picked && (
        <div className="absolute right-6 top-6 w-72 bg-background p-6 text-foreground">
          <p className="eyebrow text-muted-foreground">Região {picked.id}</p>
          <h3 className="mt-3 text-2xl">{picked.nome}</h3>
          <p className="mt-2 text-sm text-muted-foreground">A partir de <b className="text-foreground">{picked.preco}</b></p>
          {plot ? (
            <div className="mt-5 border-t border-border pt-5">
              <p className="eyebrow text-muted-foreground">Parcela escolhida</p>
              <p className="mt-2 text-xl">{picked.nome} · {plot}</p>
              <p className="text-sm text-muted-foreground">2.400 m²</p>
              <button onClick={() => alert(`Reserva da parcela ${plot} em ${picked.nome} solicitada!`)} className="mt-4 w-full bg-primary py-3 font-semibold text-primary-foreground">Reservar esta parcela</button>
            </div>
          ) : (
            <button onClick={() => { setMode("orbita"); setZoomed(picked); setZoomTo(latLon(picked.lat, picked.lon, RADIUS + 0.22)); }} className="mt-5 w-full bg-primary py-3 font-semibold text-primary-foreground">Aproximar e escolher parcela</button>
          )}
          <button onClick={() => { setZoomed(null); startFlight(picked); }} className="mt-2 w-full border border-foreground/40 py-3 font-semibold">Voar até aqui</button>
          <button onClick={() => { setPicked(null); setPlot(null); }} className="mt-2 w-full py-2 text-sm text-muted-foreground">Fechar</button>
        </div>
      )}
    </div>
  );
}

// Smoothly moves the orbit camera to a target position
function Zoomer({ target, controls, onDone }: { target: THREE.Vector3 | null; controls: React.RefObject<OrbitControlsImpl | null>; onDone: () => void }) {
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

const ROWS = ["A", "B", "C", "D"];
// Grid of purchasable parcels on the surface around a region
function Plots({ lote, selected, onSelect }: { lote: Lote; selected: string | null; onSelect: (p: string) => void }) {
  const { pos, quat } = useMemo(() => {
    const p = latLon(lote.lat, lote.lon, RADIUS * 1.002);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
    return { pos: p, quat: q };
  }, [lote]);
  const S = 0.028;
  return (
    <group position={pos} quaternion={quat}>
      {ROWS.flatMap((r, i) => [1, 2, 3, 4].map((c, j) => {
        const id = `${r}${c}`;
        const on = selected === id;
        return (
          <mesh key={id} position={[(j - 1.5) * S * 1.15, (i - 1.5) * S * 1.15, 0]} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
            <planeGeometry args={[S, S]} />
            <meshBasicMaterial color={on ? "#c8f040" : "#f4e9dc"} transparent opacity={on ? 0.85 : 0.3} side={THREE.DoubleSide} />
          </mesh>
        );
      }))}
    </group>
  );
}
