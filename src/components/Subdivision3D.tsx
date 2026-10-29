import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Focus, Map, Orbit, BookOpen, Sparkles, Trophy, Building2 } from "lucide-react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import FuturisticHouse, { sceneColor } from "@/components/FuturisticHouse";
import type { ConstructionSite } from "@/lib/construction";
import { SUBDIVISION_PARCELS, subdivisionHomes } from "@/lib/subdivision";
import SubdivisionInfrastructure from "@/components/SubdivisionInfrastructure";
import SubdivisionTerrain from "@/components/SubdivisionTerrain";
import NeighborhoodExpansion from "@/components/NeighborhoodExpansion";
import { CIVIC_DESTINATIONS, NEIGHBORING_SUBDIVISIONS, type NeighborhoodDestination } from "@/lib/neighborhood";

type View = NeighborhoodDestination;

function ParcelLabel({ id, yours, color }: { id: string; yours: boolean; color: THREE.Color }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 96;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color.getStyle(); ctx.textAlign = "center";
      ctx.font = "600 46px sans-serif"; ctx.fillText(id, 128, 46);
      if (yours) { ctx.font = "500 20px sans-serif"; ctx.fillText("SUA CASA", 128, 80); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [id, yours, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0, 0.16, 3.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3, 1.1]} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>;
}

function Neighborhood({ site, homes, view, selected, onSelect, onReady }: {
  site: ConstructionSite; homes: ConstructionSite[]; view: View; selected: string;
  onSelect: (parcel: string) => void; onReady: () => void;
}) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const ready = useRef(false);
  useFrame(() => { if (!ready.current) { ready.current = true; onReady(); } });
  const colors = useMemo(() => ({ soil: sceneColor("--printer-soil"), road: sceneColor("--subdivision-road"), plot: sceneColor("--subdivision-plot"), edge: sceneColor("--printer-concrete"), accent: sceneColor("--lime"), sky: sceneColor("--construction-surface"), text: sceneColor("--ink-foreground") }), []);
  const soilMap = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = colors.soil.getStyle(); ctx.fillRect(0, 0, 256, 256);
      let seed = 37;
      for (let i = 0; i < 6000; i++) {
        seed = (seed * 16807) % 2147483647; const x = seed % 256;
        seed = (seed * 16807) % 2147483647; const y = seed % 256;
        ctx.globalAlpha = 0.15; ctx.fillStyle = (i % 2 ? colors.road : colors.edge).getStyle(); ctx.fillRect(x, y, 1 + i % 3, 1);
      }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [colors]);
  useEffect(() => () => soilMap.dispose(), [soilMap]);
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
  const built = subdivisionHomes(site.region, homes);
  return <>
    <color attach="background" args={[colors.sky]} />
    <ambientLight intensity={1.4} />
    <directionalLight position={[25, 45, 30]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} />
    <Environment><Lightformer position={[0, 20, 0]} rotation-x={Math.PI / 2} scale={[50, 50, 1]} intensity={2} /></Environment>
    <SubdivisionTerrain texture={soilMap} />
    {[-22, -11, 0, 11, 22].flatMap(offset => [
      <mesh key={`road-x-${offset}`} position={[offset, 0.025, 0]} receiveShadow><boxGeometry args={[2.7, 0.05, 47]} /><meshStandardMaterial color={colors.road} roughness={0.95} /></mesh>,
      <mesh key={`road-z-${offset}`} position={[0, 0.025, offset]} receiveShadow><boxGeometry args={[47, 0.05, 2.7]} /><meshStandardMaterial color={colors.road} roughness={0.95} /></mesh>,
    ])}
    {SUBDIVISION_PARCELS.map(parcel => {
      const yours = parcel.id === site.parcel;
      const completed = built.some(home => home.id === parcel.id);
      const edge = selected === parcel.id || yours ? colors.accent : colors.edge;
      return <group key={parcel.id} position={[parcel.x, 0, parcel.z]} onClick={e => { e.stopPropagation(); onSelect(parcel.id); }}>
        <mesh position={[0, 0.055, 0]} receiveShadow><boxGeometry args={[8.1, 0.11, 8.1]} /><meshStandardMaterial color={colors.plot} roughness={0.95} /></mesh>
        {[-4, 4].flatMap(n => [
          <mesh key={`x-${n}`} position={[n, 0.13, 0]}><boxGeometry args={[0.075, 0.07, 8.1]} /><meshStandardMaterial color={edge} /></mesh>,
          <mesh key={`z-${n}`} position={[0, 0.13, n]}><boxGeometry args={[8.1, 0.07, 0.075]} /><meshStandardMaterial color={edge} /></mesh>,
        ])}
        {completed && <group position={[0, 0.12, -0.6]} scale={0.85}><FuturisticHouse /></group>}
        <ParcelLabel id={parcel.id} yours={yours} color={yours ? colors.accent : colors.text} />
      </group>;
    })}
    <SubdivisionInfrastructure />
    <NeighborhoodExpansion />
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
      <Button size="sm" variant={view === "leisure" ? "default" : "secondary"} onClick={() => setView("leisure")}><Sparkles /> Lazer Orbital</Button>
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