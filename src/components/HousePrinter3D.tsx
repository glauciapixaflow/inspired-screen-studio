import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Printer } from "lucide-react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { constructionStage, type ConstructionSite } from "@/lib/construction";

function sceneColor(token: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Color();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

type BoxProps = { position: [number, number, number]; size: [number, number, number]; color: THREE.Color };
function Block({ position, size, color }: BoxProps) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}

function PrinterScene({ running, cycle, onProgress }: { running: boolean; cycle: number; onProgress: (p: number) => void }) {
  const colors = useMemo(() => ({
    soil: sceneColor("--printer-soil"), concrete: sceneColor("--printer-concrete"),
    metal: sceneColor("--printer-metal"), glass: sceneColor("--printer-glass"),
    accent: sceneColor("--lime"), sky: sceneColor("--ink"),
  }), []);
  const elapsed = useRef(0);
  const lastReport = useRef(0);
  const layers = useRef<Array<THREE.Group | null>>([]);
  const head = useRef<THREE.Group | null>(null);
  const bridge = useRef<THREE.Group | null>(null);
  const windows = useRef<THREE.Group | null>(null);
  useEffect(() => { elapsed.current = 0; lastReport.current = 0; onProgress(0); }, [cycle, onProgress]);
  useFrame((_, delta) => {
    if (running) elapsed.current = Math.min(40, elapsed.current + Math.min(delta, 0.1));
    const progress = elapsed.current / 40;
    const currentLayer = Math.min(49, Math.floor(progress * 50));
    layers.current.forEach((layer, index) => { if (layer) layer.visible = index < currentLayer || progress === 1; });
    if (windows.current) windows.current.visible = progress >= 0.88;
    // A rectangular toolpath follows the perimeter of each printed layer.
    const step = (elapsed.current * 1.3) % 4;
    let x = 0, z = 0;
    if (step < 1) { x = -2 + step * 4; z = 1.5; }
    else if (step < 2) { x = 2; z = 1.5 - (step - 1) * 3; }
    else if (step < 3) { x = 2 - (step - 2) * 4; z = -1.5; }
    else { x = -2; z = -1.5 + (step - 3) * 3; }
    const height = 0.3 + currentLayer * 0.06;
    if (head.current) head.current.position.set(progress === 1 ? 2.8 : x, height + 0.24, 0);
    if (bridge.current) bridge.current.position.set(0, 0, progress === 1 ? -2.3 : z);
    if (elapsed.current - lastReport.current > 0.15 || progress === 1) {
      lastReport.current = elapsed.current;
      onProgress(progress);
    }
  });
  return <>
    <color attach="background" args={[colors.sky]} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[6, 10, 7]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
    <Stars radius={70} depth={30} count={900} factor={2} fade />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color={colors.soil} roughness={1} /></mesh>
    <Block position={[0, 0.12, 0]} size={[4.5, 0.24, 3.5]} color={colors.concrete} />
    {Array.from({ length: 50 }, (_, i) => {
      const y = 0.28 + i * 0.06;
      const windowLevel = y > 1.05 && y < 2.05;
      return <group key={i} ref={(node) => { layers.current[i] = node; }} visible={false}>
        {i >= 44 ? <Block position={[0, y, 0]} size={[4.3, 0.05, 3.3]} color={colors.concrete} /> : <>
          <Block position={[0, y, -1.5]} size={[4, 0.052, 0.18]} color={colors.concrete} />
          {[-1, 1].map((side) => <group key={side}>
            {windowLevel ? <>
              <Block position={[side * 2, y, -1.03]} size={[0.18, 0.052, 0.94]} color={colors.concrete} />
              <Block position={[side * 2, y, 1.03]} size={[0.18, 0.052, 0.94]} color={colors.concrete} />
            </> : <Block position={[side * 2, y, 0]} size={[0.18, 0.052, 3]} color={colors.concrete} />}
            {windowLevel ? <>
              <Block position={[side * 0.62, y, 1.5]} size={[0.24, 0.052, 0.18]} color={colors.concrete} />
              <Block position={[side * 1.85, y, 1.5]} size={[0.3, 0.052, 0.18]} color={colors.concrete} />
            </> : <Block position={[side * 1.25, y, 1.5]} size={[1.5, 0.052, 0.18]} color={colors.concrete} />}
          </group>)}
          {y > 2.35 && <Block position={[0, y, 1.5]} size={[1, 0.052, 0.18]} color={colors.concrete} />}
        </>}
      </group>;
    })}
    <group ref={windows} visible={false}>
      {[-1, 1].map((side) => <group key={side}>
        <Block position={[side * 1.22, 1.55, 1.5]} size={[0.96, 0.97, 0.05]} color={colors.glass} />
        <Block position={[side * 2, 1.55, 0]} size={[0.05, 0.97, 1.08]} color={colors.glass} />
      </group>)}
      <Block position={[0, 1.28, 1.48]} size={[0.9, 2.05, 0.09]} color={colors.metal} />
    </group>
    {[-3, 3].flatMap((x) => [-2.5, 2.5].map((z) => <group key={`${x}-${z}`}>
      <Block position={[x, 2.3, z]} size={[0.18, 4.6, 0.18]} color={colors.metal} />
      <Block position={[x, 0.15, z]} size={[0.65, 0.3, 0.65]} color={colors.metal} />
    </group>))}
    {[-3, 3].map((x) => <Block key={x} position={[x, 4.55, 0]} size={[0.24, 0.22, 5.4]} color={colors.accent} />)}
    <group ref={bridge}>
      <Block position={[0, 4.55, 0]} size={[6.3, 0.22, 0.24]} color={colors.metal} />
      <group ref={head}>
        <Block position={[0, 0.18, 0]} size={[0.45, 0.38, 0.45]} color={colors.accent} />
        <Block position={[0, 1.9, 0]} size={[0.08, 3.6, 0.08]} color={colors.metal} />
        <mesh position={[0, -0.14, 0]}><cylinderGeometry args={[0.065, 0.03, 0.25, 12]} /><meshStandardMaterial color={colors.metal} /></mesh>
      </group>
    </group>
    <OrbitControls makeDefault target={[0, 1.6, 0]} minDistance={8} maxDistance={23} maxPolarAngle={Math.PI / 2 - 0.03} enablePan={false} />
  </>;
}

export default function HousePrinter3D({ site, onBack }: { site: ConstructionSite; onBack: () => void }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(true);
  const [cycle, setCycle] = useState(0);
  useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRunning(false); }, []);
  const complete = progress >= 1;
  return <section className="absolute inset-0 z-30 bg-construction-surface text-construction-text" aria-label="Impressão 3D da casa">
    <Canvas shadows camera={{ position: [10, 7, 11], fov: 46 }}><PrinterScene running={running && !complete} cycle={cycle} onProgress={setProgress} /></Canvas>
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase">Red Planet Properties · Simulação 3D</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Sua casa em Marte</h1>
        <p className="mt-2 text-sm">{site.region} · Parcela {site.parcel}</p>
      </div>
      <Button variant="secondary" onClick={onBack} className="pointer-events-auto"><ArrowLeft /> Voltar ao mapa</Button>
    </header>
    <div className="absolute inset-x-0 bottom-0 border-t border-construction-text/20 bg-construction-surface/95 p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center gap-2"><Printer size={19} /><h2 className="font-semibold" aria-live="polite">{constructionStage(progress)}</h2></div>
          <div className="mt-3 flex items-center gap-4"><progress aria-label="Progresso da impressão" value={progress} max={1} className="h-2 w-full accent-lime" /><span className="w-12 text-right text-sm tabular-nums">{Math.round(progress * 100)}%</span></div>
          <p className="mt-2 text-xs text-construction-text/65">Projeto ilustrativo · Reserva não salva · Sem construção real</p>
        </div>
        <div className="flex gap-2">
          {!complete && <Button variant="secondary" onClick={() => setRunning((value) => !value)}>{running ? <Pause /> : <Play />}{running ? "Pausar" : "Continuar"}</Button>}
          <Button variant="outline" className="border-construction-text/30 bg-construction-surface text-construction-text" onClick={() => { setCycle((value) => value + 1); setRunning(true); }}><RotateCcw /> Reimprimir</Button>
        </div>
      </div>
    </div>
  </section>;
}