import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import CivicInteriorScene from "@/components/CivicInteriorScene";
import { INTERIOR_TOURS, nextTourStop, type CivicInterior } from "@/lib/interior-tours";

function TourCamera({ interior, stop, onReady }: { interior: CivicInterior; stop: number; onReady: () => void }) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const ready = useRef(false);
  useFrame(() => { if (!ready.current) { ready.current = true; onReady(); } });
  useEffect(() => {
    const point = INTERIOR_TOURS[interior].stops[stop]; if (!point) return;
    camera.position.set(...point.position); camera.lookAt(...point.target);
    // A short orbit radius pivots the view at eye level without leaving the room.
    const direction = camera.getWorldDirection(camera.position.clone()).multiplyScalar(0.1);
    controls.current?.target.copy(camera.position).add(direction);
    controls.current?.update(); invalidate();
  }, [camera, interior, stop, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom={false} minPolarAngle={0.35} maxPolarAngle={2.5} rotateSpeed={0.5} />;
}

export default function CivicInteriorTour({ interior, onBack }: { interior: CivicInterior; onBack: () => void }) {
  const [stop, setStop] = useState(0);
  const [playing, setPlaying] = useState(false);
  const wrapper = useRef<HTMLElement | null>(null);
  const tour = INTERIOR_TOURS[interior];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStop(s => nextTourStop(s, 1, tour.stops.length)), 8000);
    return () => window.clearInterval(timer);
  }, [playing, tour.stops.length]);
  const select = (value: number) => { setPlaying(false); setStop(value); };
  return <section ref={wrapper} className="absolute inset-0 z-50 bg-construction-surface text-construction-text" aria-label={`Tour interior · ${tour.name}`}>
    <Canvas frameloop="demand" camera={{ position: [0, 2, 9], fov: 65, near: 0.02 }}>
      <CivicInteriorScene interior={interior} />
      <TourCamera interior={interior} stop={stop} onReady={() => wrapper.current?.setAttribute("data-scene-ready", "true")} />
    </Canvas>
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 bg-construction-surface/85 p-4 sm:p-6">
      <div><p className="text-xs uppercase">Tour interior · {stop + 1}/{tour.stops.length}</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{tour.name}</h1></div>
      <Button variant="secondary" onClick={onBack} className="pointer-events-auto"><ArrowLeft /> Voltar ao loteamento</Button>
    </header>
    <footer className="absolute inset-x-0 bottom-0 border-t border-construction-text/20 bg-construction-surface/95 p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="font-semibold">{tour.stops[stop]?.name}</p><div className="flex shrink-0 gap-2">
        <Button size="icon" variant="secondary" aria-label="Parada anterior" title="Parada anterior" onClick={() => select(nextTourStop(stop, -1, tour.stops.length))}><ChevronLeft /></Button>
        <Button size="icon" variant="secondary" aria-label={playing ? "Pausar tour" : "Iniciar tour automático"} title={playing ? "Pausar tour" : "Iniciar tour automático"} onClick={() => setPlaying(p => !p)}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="secondary" aria-label="Próxima parada" title="Próxima parada" onClick={() => select(nextTourStop(stop, 1, tour.stops.length))}><ChevronRight /></Button>
      </div></div>
      <nav className="flex flex-wrap gap-2" aria-label="Paradas do tour">{tour.stops.map((point, i) => <Button key={point.name} size="sm" variant={stop === i ? "default" : "secondary"} aria-pressed={stop === i} onClick={() => select(i)}>{point.name}</Button>)}</nav>
    </footer>
  </section>;
}