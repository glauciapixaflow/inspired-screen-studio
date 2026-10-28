import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Printer, MapPin } from "lucide-react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { constructionStage, type ConstructionSite } from "@/lib/construction";

import FuturisticHouse, { sceneColor } from "@/components/FuturisticHouse";

type BoxProps = { position: [number, number, number]; size: [number, number, number]; color: THREE.Color };
function Block({ position, size, color }: BoxProps) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}

function PrinterScene({ running, cycle, initialComplete, onProgress }: { running: boolean; cycle: number; initialComplete: boolean; onProgress: (p: number) => void }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const narrow = size.width / size.height < 0.8;
    camera.position.set(narrow ? 19 : 10, narrow ? 12 : 7, narrow ? 21 : 11);
    camera.lookAt(0, 1.6, 0);
  }, [camera, size.width, size.height]);
  const colors = useMemo(() => ({
    soil: sceneColor("--printer-soil"), concrete: sceneColor("--printer-concrete"),
    metal: sceneColor("--printer-metal"), glass: sceneColor("--printer-glass"),
    accent: sceneColor("--lime"), sky: sceneColor("--ink"),
  }), []);
  const elapsed = useRef(0);
  const lastReport = useRef(0);
  const [buildProgress, setBuildProgress] = useState(initialComplete ? 1 : 0);
  const printer = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Group | null>(null);
  const bridge = useRef<THREE.Group | null>(null);

  useEffect(() => { const start = initialComplete && cycle === 0 ? 40 : 0; elapsed.current = start; lastReport.current = 0; setBuildProgress(start / 40); onProgress(start / 40); }, [cycle, initialComplete, onProgress]);
  useFrame((_, delta) => {
    if (running) elapsed.current = Math.min(40, elapsed.current + delta);
    const progress = elapsed.current / 40;
    const currentLayer = Math.min(49, Math.floor(progress * 50));
    if (printer.current) printer.current.visible = progress < 1;
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
      setBuildProgress(progress);
      onProgress(progress);
    }
  });
  return <>
    <color attach="background" args={[colors.sky]} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[6, 10, 7]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
    <Stars radius={70} depth={30} count={900} factor={2} fade />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color={colors.soil} roughness={1} /></mesh>
    <FuturisticHouse progress={buildProgress} />
    <group ref={printer}>
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
    </group>
    <Environment><Lightformer intensity={3} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} /><Lightformer intensity={2} position={[-8, 4, 3]} rotation-y={Math.PI / 2} scale={[8, 8, 1]} /></Environment>
    <OrbitControls makeDefault target={[0, 1.6, 0]} minDistance={8} maxDistance={23} maxPolarAngle={Math.PI / 2 - 0.03} enablePan={false} />
  </>;
}

export default function HousePrinter3D({ site, onBack, onComplete, onSubdivision, initialComplete = false }: { site: ConstructionSite; onBack: () => void; onComplete: (site: ConstructionSite) => void; onSubdivision: () => void; initialComplete?: boolean }) {
  const [progress, setProgress] = useState(initialComplete ? 1 : 0);
  const [running, setRunning] = useState(true);
  const [cycle, setCycle] = useState(0);
  useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRunning(false); }, []);
  const complete = progress >= 1;
  useEffect(() => { if (complete) onComplete(site); }, [complete, onComplete, site]);
  return <section className="absolute inset-0 z-30 bg-construction-surface text-construction-text" aria-label="Impressão 3D da casa">
    <Canvas shadows onCreated={({ gl }) => { gl.localClippingEnabled = true; }} camera={{ position: [10, 7, 11], fov: 46 }}><PrinterScene running={running && !complete} cycle={cycle} initialComplete={initialComplete} onProgress={setProgress} /></Canvas>
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase">Red Planet Properties · Simulação 3D</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Seu habitat em Marte</h1>
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
          {complete && <Button onClick={onSubdivision}><MapPin /> Ver loteamento 3D</Button>}
          {!complete && <Button variant="secondary" onClick={() => setRunning((value) => !value)}>{running ? <Pause /> : <Play />}{running ? "Pausar" : "Continuar"}</Button>}
          <Button variant="outline" className="border-construction-text/30 bg-construction-surface text-construction-text" onClick={() => { setCycle((value) => value + 1); setRunning(true); }}><RotateCcw /> Reimprimir</Button>
        </div>
      </div>
    </div>
  </section>;
}