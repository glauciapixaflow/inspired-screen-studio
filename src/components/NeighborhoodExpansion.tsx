import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import FuturisticHouse, { sceneColor } from "@/components/FuturisticHouse";
import { CIVIC_DESTINATIONS, NEIGHBORING_SUBDIVISIONS } from "@/lib/neighborhood";
import { SUBDIVISION_PARCELS } from "@/lib/subdivision";

function DistrictLabel({ name }: { name: string }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = sceneColor("--construction-text").getStyle();
      ctx.font = "600 56px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(name.toUpperCase(), 512, 86);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [name]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 26]}><planeGeometry args={[34, 4.25]} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>;
}

function NeighborPlots() {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  const color = useMemo(() => sceneColor("--subdivision-plot"), []);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D();
    NEIGHBORING_SUBDIVISIONS.forEach((area, i) => SUBDIVISION_PARCELS.forEach((parcel, j) => {
      transform.position.set(area.x + parcel.x, 0.07, area.z + parcel.z);
      transform.updateMatrix(); mesh.setMatrixAt(i * 16 + j, transform.matrix);
    }));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[undefined, undefined, 32]} receiveShadow><boxGeometry args={[8.1, 0.14, 8.1]} /><meshStandardMaterial color={color} roughness={0.9} /></instancedMesh>;
}

// Bespoke parametric architecture: terraced elliptical library and geodesic leisure halls.
function CivicBuildings() {
  const colors = useMemo(() => ({ shell: sceneColor("--civic-shell"), glass: sceneColor("--civic-glass"), metal: sceneColor("--printer-metal"), light: sceneColor("--walkway-light"), gold: sceneColor("--civic-gold"), water: sceneColor("--civic-water"), garden: sceneColor("--civic-garden") }), []);
  const shell = { color: colors.shell, metalness: 0.35, roughness: 0.4 };
  const glass = { color: colors.glass, metalness: 0.65, roughness: 0.17, transparent: true, opacity: 0.82 };
  const facade = useMemo(() => {
    const points = [new THREE.Vector2(14, 0), new THREE.Vector2(14, 1), new THREE.Vector2(12, 4), new THREE.Vector2(11, 8), new THREE.Vector2(8, 12), new THREE.Vector2(7, 17), new THREE.Vector2(4, 20)];
    return new THREE.LatheGeometry(points, 64);
  }, []);
  useEffect(() => () => facade.dispose(), [facade]);
  return <>
    <group position={[0, 0, -65]} name="mega-futuristic-library">
      <mesh position={[0, 0.1, 0]} scale={[1, 1, 0.85]} receiveShadow><cylinderGeometry args={[22, 22, 0.2, 64]} /><meshStandardMaterial {...shell} /></mesh>
      <mesh geometry={facade} scale={[1, 1, 0.75]} castShadow><meshStandardMaterial {...glass} side={THREE.DoubleSide} /></mesh>
      {[0, 1, 2, 3, 4].map(i => <group key={i} position={[0, 1 + i * 4, 0]} rotation={[0, i * 0.16, 0]}>
        <mesh scale={[1, 1, 0.78]} castShadow><cylinderGeometry args={[15 - i * 2, 15 - i * 2, 0.65, 64]} /><meshStandardMaterial {...shell} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]}><torusGeometry args={[15 - i * 2, 0.1, 6, 64]} /><meshStandardMaterial color={colors.gold} emissive={colors.gold} emissiveIntensity={0.55} /></mesh>
      </group>)}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = i * Math.PI / 8;
        return <mesh key={i} position={[Math.cos(angle) * 11.3, 6.5, Math.sin(angle) * 8.5]} rotation={[0, -angle, 0.2]} castShadow><cylinderGeometry args={[0.18, 0.35, 12, 6]} /><meshStandardMaterial {...shell} /></mesh>;
      })}
      <mesh position={[0, 21, 0]} scale={[1, 0.4, 0.75]}><sphereGeometry args={[4.4, 32, 16]} /><meshStandardMaterial {...glass} /></mesh>
      <mesh position={[0, 2.5, 11]}><boxGeometry args={[5, 5, 0.25]} /><meshStandardMaterial color={colors.metal} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 0.22 + i * 0.18, 17 - i * 1.2]}><boxGeometry args={[9 - i, 0.4, 1.3]} /><meshStandardMaterial {...shell} /></mesh>)}
      <DistrictLabel name="Megabiblioteca" />
    </group>
    {CIVIC_DESTINATIONS.filter(place => place.id !== "library").map(place => <group key={place.id} position={[place.x, 0, place.z]} name={`futuristic-${place.id}-center`}>
      <mesh position={[0, 0.15, 0]} receiveShadow><cylinderGeometry args={[16, 16, 0.3, 48]} /><meshStandardMaterial {...shell} /></mesh>
      <mesh position={[0, 1, 0]} scale={[1, place.id === "sports" ? 0.75 : 0.95, 1]} castShadow><sphereGeometry args={[12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...glass} side={THREE.DoubleSide} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 1, 0]} rotation={[0, i * Math.PI / 4, 0]} scale={[1, place.id === "sports" ? 0.75 : 0.95, 1]}><torusGeometry args={[12.1, 0.2, 8, 48, Math.PI]} /><meshStandardMaterial {...shell} /></mesh>)}
      <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[12.2, 0.12, 8, 64]} /><meshStandardMaterial color={colors.light} emissive={colors.light} emissiveIntensity={0.8} /></mesh>
      {place.id === "sports" ? <>
        <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[12, 16]} /><meshStandardMaterial color={colors.garden} /></mesh>
        <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.5, 2.6, 32]} /><meshBasicMaterial color={colors.shell} /></mesh>
      </> : <>
        <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[8, 48]} /><meshPhysicalMaterial color={colors.water} metalness={0.25} roughness={0.08} clearcoat={1} /></mesh>
        <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[8.3, 0.3, 8, 48]} /><meshStandardMaterial color={colors.gold} /></mesh>
      </>}
      <DistrictLabel name={place.id === "sports" ? "Arena Solaris" : "Lazer Orbital"} />
    </group>)}
  </>;
}

export default function NeighborhoodExpansion() {
  const colors = useMemo(() => ({ road: sceneColor("--subdivision-road"), light: sceneColor("--walkway-light"), shell: sceneColor("--printer-concrete") }), []);
  return <group name="nearby-subdivisions-and-civic-campus">
    <NeighborPlots />
    {NEIGHBORING_SUBDIVISIONS.map(area => <group key={area.id} position={[area.x, 0, area.z]} name={area.id}>
      <mesh position={[0, 0.025, 0]} receiveShadow><boxGeometry args={[47, 0.05, 47]} /><meshStandardMaterial color={colors.road} /></mesh>
      {[[-16.5, -16.5], [16.5, 16.5]].map(([x = 0, z = 0], i) => <group key={i} position={[x, 0.14, z]} scale={0.85}><FuturisticHouse /></group>)}
      <DistrictLabel name={area.name} />
    </group>)}
    {[[0, 0.08, 0, 184, 2.6], [0, 0.08, -62, 133, 2.6]].map(([x = 0, y = 0, z = 0, width = 1, depth = 1], i) => <mesh key={i} position={[x, y, z]} receiveShadow><boxGeometry args={[width, 0.16, depth]} /><meshStandardMaterial color={colors.road} /></mesh>)}
    <mesh position={[0, 0.08, -33]} receiveShadow><boxGeometry args={[2.6, 0.16, 66]} /><meshStandardMaterial color={colors.road} /></mesh>
    {/* Elevated pedestrian connection to civic campus, clear of all parcel footprints. */}
    <mesh position={[0, 4.1, -33]} castShadow><boxGeometry args={[1.8, 0.22, 66]} /><meshStandardMaterial color={colors.shell} /></mesh>
    {[-0.85, 0.85].map(x => <group key={x}>
      <mesh position={[x, 5, -33]}><boxGeometry args={[0.08, 0.08, 66]} /><meshStandardMaterial color={colors.shell} /></mesh>
      <mesh position={[x, 4.28, -33]}><boxGeometry args={[0.05, 0.05, 66]} /><meshStandardMaterial color={colors.light} emissive={colors.light} emissiveIntensity={0.8} /></mesh>
    </group>)}
    {[-34, -46, -58].map(z => <mesh key={z} position={[0, 2, z]}><boxGeometry args={[0.4, 4, 0.4]} /><meshStandardMaterial color={colors.shell} /></mesh>)}
    <CivicBuildings />
  </group>;
}