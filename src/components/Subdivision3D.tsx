import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Focus, Map, Orbit, BookOpen, Sparkles, Trophy, Building2 } from "lucide-react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import type { ConstructionSite } from "@/lib/construction";
import { SUBDIVISION_PARCELS } from "@/lib/subdivision";
import { CIVIC_DESTINATIONS, NEIGHBORING_SUBDIVISIONS, type NeighborhoodDestination } from "@/lib/neighborhood";

import SubdivisionEnvironment from "@/components/SubdivisionEnvironment";

type View = NeighborhoodDestination;

function Neighborhood({ site, homes, view, selected, onSelect, onReady }: {
  site: ConstructionSite; homes: ConstructionSite[]; view: View; selected: string;
  onSelect: (parcel: string) => void; onReady: () => void;
}) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const ready = useRef(false);
  useFrame(() => { if (!ready.current) { ready.current = true; onReady(); } });
  useEffect(() => {
    const home = SUBDIVISION_PARCELS.find(parcel => parcel.id === site.parcel);
    const mobile = size.width / size.height < 0.85;
    const place = [...CIVIC_DESTINATIONS, ...NEIGHBORING_SUBDIVISIONS].find(place => place.id === view);
    const target = view === "home" && home ? new THREE.Vector3(home.x, 1, home.z) : place ? new THREE.Vector3(place.x, 3, place.z) : new THREE.Vector3(0, 0, -25);
    camera.up.set(0, 1, 0);
    if (view === "home") camera.position.copy(target).add(new THREE.Vector3(mobile ? 15 : 10, mobile ? 15 : 9, mobile ? 20 : 13));
    else if (place) camera.position.copy(target).add(new THREE.Vector3(mobile ? 42 : 30, mobile ? 50 : 30, mobile ? 55 : 40));
    else if (view === "top") camera.position.set(0, mobile ? 245 : 180, -24.99);
    else camera.position.set(mobile ? 240 : 110, mobile ? 250 : 115, mobile ? 220 : 105);
    camera.lookAt(target); controls.current?.target.copy(target); controls.current?.update(); invalidate();
  }, [view, site.parcel, camera, size.width, size.height, invalidate]);
  return <>
    <SubdivisionEnvironment site={site} homes={homes} selected={selected} onSelect={onSelect} />
    <OrbitControls ref={controls} makeDefault minDistance={9} maxDistance={480} maxPolarAngle={Math.PI / 2 - 0.04} enablePan />
  </>;
}

export default function Subdivision3D({ site, homes, onBack }: { site: ConstructionSite; homes: ConstructionSite[]; onBack: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState(site.parcel);
  const wrapper = useRef<HTMLElement | null>(null);
  const built = homes.some(home => home.region === site.region && home.parcel === selected);
  return <section ref={wrapper} className="absolute inset-0 z-40 bg-construction-surface text-construction-text" aria-label="Mapa 3D do loteamento">
    <Canvas shadows frameloop="demand" camera={{ position: [42, 53, 51], fov: 45 }}><Neighborhood site={site} homes={homes} view={view} selected={selected} onSelect={setSelected} onReady={() => wrapper.current?.setAttribute("data-subdivision-ready", "true")} /></Canvas>
    <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
      <div><p className="text-xs uppercase">Red Planet Properties</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Loteamento {site.region}</h1><p className="mt-2 text-sm">Sua casa · Parcela {site.parcel}</p></div>
      <Button variant="secondary" onClick={onBack} className="pointer-events-auto"><ArrowLeft /> Voltar a Marte</Button>
    </header>
    <nav className="absolute left-4 top-40 flex max-w-[calc(100%-2rem)] flex-wrap gap-2 sm:left-6 sm:top-32" aria-label="Destinos da vizinhança">
      <Button size="sm" variant={view === "aurora" ? "default" : "secondary"} onClick={() => setView("aurora")}><Building2 /> Aurora</Button>
      <Button size="sm" variant={view === "horizonte" ? "default" : "secondary"} onClick={() => setView("horizonte")}><Building2 /> Horizonte</Button>
      <Button size="sm" variant={view === "library" ? "default" : "secondary"} onClick={() => setView("library")}><BookOpen /> Megabiblioteca</Button>
      <Button size="sm" variant={view === "leisure" ? "default" : "secondary"} onClick={() => setView("leisure")}><Sparkles /> Laser Orbital</Button>
      <Button size="sm" variant={view === "sports" ? "default" : "secondary"} onClick={() => setView("sports")}><Trophy /> Arena Solaris</Button>
    </nav>
    <footer className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-construction-text/20 bg-construction-surface/95 p-4 sm:p-6">
      <div className="text-sm"><p className="font-semibold">Parcela {selected} · {built ? "Casa concluída" : "Sem construção"}</p><p className="mt-1 text-xs text-construction-text/65">Loteamento ilustrativo · Reserva não salva</p></div>
      <div className="flex flex-wrap gap-2" aria-label="Vistas do loteamento">
        <Button variant={view === "overview" ? "default" : "secondary"} onClick={() => setView("overview")}><Orbit /> Geral</Button>
        <Button variant={view === "home" ? "default" : "secondary"} onClick={() => { setSelected(site.parcel); setView("home"); }}><Focus /> Minha casa</Button>
        <Button variant={view === "top" ? "default" : "secondary"} onClick={() => setView("top")}><Map /> Superior</Button>
      </div>
    </footer>
  </section>;
}