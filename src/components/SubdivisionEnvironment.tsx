import { useEffect, useMemo } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import FuturisticHouse, { sceneColor } from "@/components/FuturisticHouse";
import type { ConstructionSite } from "@/lib/construction";
import { SUBDIVISION_PARCELS, subdivisionHomes, HABITAT_SCALE } from "@/lib/subdivision";
import SubdivisionInfrastructure from "@/components/SubdivisionInfrastructure";
import SubdivisionTerrain from "@/components/SubdivisionTerrain";
import NeighborhoodExpansion from "@/components/NeighborhoodExpansion";

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

export default function SubdivisionEnvironment({ site, homes, selected = site.parcel, printingParcel, onSelect = () => {} }: {
  site: ConstructionSite; homes: ConstructionSite[]; selected?: string; printingParcel?: string; onSelect?: (parcel: string) => void;
}) {
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
        {completed && parcel.id !== printingParcel && <group position={[0, 0.12, -0.6]} scale={HABITAT_SCALE}><FuturisticHouse /></group>}
        <ParcelLabel id={parcel.id} yours={yours} color={yours ? colors.accent : colors.text} />
      </group>;
    })}
    <SubdivisionInfrastructure />
    <NeighborhoodExpansion />
  </>;
}
