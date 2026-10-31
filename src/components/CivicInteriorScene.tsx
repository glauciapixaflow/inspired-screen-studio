import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { sceneColor } from "@/components/FuturisticHouse";
import type { CivicInterior } from "@/lib/interior-tours";

function Archive({ colors }: { colors: Record<string, THREE.Color> }) {
  const books = useRef<THREE.InstancedMesh | null>(null);
  useLayoutEffect(() => {
    const mesh = books.current; if (!mesh) return;
    const transform = new THREE.Object3D();
    for (let i = 0; i < 384; i++) {
      const rack = Math.floor(i / 96), shelf = Math.floor((i % 96) / 24), book = i % 24;
      transform.position.set(-9 + rack * 2.4, 0.7 + shelf * 0.9, -9 + book * 0.13);
      transform.scale.set(1, 0.7 + (i % 5) * 0.06, 1); transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      mesh.setColorAt(i, [colors.gold, colors.glass, colors.garden, colors.shell][i % 4] ?? colors.shell);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [colors]);
  return <>
    <instancedMesh ref={books} args={[undefined, undefined, 384]}><boxGeometry args={[0.1, 0.7, 0.5]} /><meshStandardMaterial roughness={0.7} /></instancedMesh>
    {[0, 1, 2, 3].map(rack => <group key={rack} position={[-9 + rack * 2.4, 0, -7.5]}>
      {[0, 1, 2, 3, 4].map(shelf => <mesh key={shelf} position={[0, 0.25 + shelf * 0.9, 0]}><boxGeometry args={[0.9, 0.1, 4]} /><meshStandardMaterial color={colors.shell} metalness={0.4} /></mesh>)}
      <mesh position={[0, 2, -1.95]}><boxGeometry args={[0.9, 4, 0.12]} /><meshStandardMaterial color={colors.metal} /></mesh>
    </group>)}
    <group position={[0, 0, -2]}>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[2.4, 2.8, 0.5, 48]} /><meshStandardMaterial color={colors.shell} /></mesh>
      <mesh position={[0, 3.5, 0]}><icosahedronGeometry args={[1.4, 2]} /><meshStandardMaterial color={colors.glass} wireframe emissive={colors.light} emissiveIntensity={0.4} /></mesh>
      {[1.9, 2.7, 4.3].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.9, 0.045, 8, 64]} /><meshStandardMaterial color={colors.gold} /></mesh>)}
    </group>
  </>;
}

export default function CivicInteriorScene({ interior }: { interior: CivicInterior }) {
  const colors = useMemo(() => Object.fromEntries(Object.entries({ shell: "--civic-shell", glass: "--civic-glass", gold: "--civic-gold", garden: "--civic-garden", water: "--civic-water", metal: "--printer-metal", light: "--walkway-light", sky: "--terrain-ridge" }).map(([key, token]) => [key, sceneColor(token)])), []);
  const floor = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = colors.shell.getStyle(); ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = colors.metal.getStyle(); ctx.globalAlpha = 0.18; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 254, 254);
      for (let i = 0; i < 800; i++) { ctx.globalAlpha = 0.03; ctx.fillStyle = colors.metal.getStyle(); ctx.fillRect(i * 37 % 256, i * 71 % 256, 2, 2); }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(14, 14); return texture;
  }, [colors]);
  useEffect(() => () => floor.dispose(), [floor]);
  return <>
    <color attach="background" args={[colors.sky]} />
    <ambientLight intensity={1.3} />
    <directionalLight position={[4, 12, 5]} intensity={2.4} />
    <Environment resolution={64}><Lightformer position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} intensity={2} /><Lightformer position={[0, 3, -12]} scale={[16, 6, 1]} intensity={1} color={colors.glass} /></Environment>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[14, 64]} /><meshStandardMaterial map={floor} roughness={0.45} metalness={0.15} /></mesh>
    <mesh position={[0, -0.15, 0]}><cylinderGeometry args={[14, 14, 0.3, 64]} /><meshStandardMaterial color={colors.shell} /></mesh>
    <mesh scale={[1, 0.8, 1]}><sphereGeometry args={[14, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={colors.glass} transparent opacity={0.18} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} rotation={[0, i * Math.PI / 12, 0]} scale={[1, 0.8, 1]}><torusGeometry args={[14, 0.12, 8, 64, Math.PI]} /><meshStandardMaterial color={colors.shell} metalness={0.45} /></mesh>)}
    {[3, 7, 10].map(y => <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[Math.sqrt(196 - (y / 0.8) ** 2), 0.05, 8, 64]} /><meshStandardMaterial color={colors.light} emissive={colors.light} emissiveIntensity={0.6} /></mesh>)}
    {interior === "library" && <Archive colors={colors} />}
    {interior === "leisure" && <>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[5, 64]} /><meshPhysicalMaterial color={colors.water} metalness={0.3} roughness={0.1} clearcoat={1} /></mesh>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[5.15, 0.16, 8, 64]} /><meshStandardMaterial color={colors.gold} /></mesh>
    </>}
    {interior === "sports" && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><planeGeometry args={[11, 17]} /><meshStandardMaterial color={colors.garden} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}><ringGeometry args={[2.3, 2.36, 48]} /><meshBasicMaterial color={colors.shell} /></mesh>
      {[-8, 0, 8].map(z => <mesh key={z} position={[0, 0.05, z]}><boxGeometry args={[10.8, 0.02, 0.07]} /><meshBasicMaterial color={colors.shell} /></mesh>)}
      {[-5.4, 5.4].map(x => <mesh key={x} position={[x, 0.05, 0]}><boxGeometry args={[0.07, 0.02, 16]} /><meshBasicMaterial color={colors.shell} /></mesh>)}
      {[-1, 1].map(side => <group key={side} position={[side * 10, 0, -4]}>{[0, 1, 2].map(i => <mesh key={i} position={[side * i * 0.6, 0.25 + i * 0.35, 0]}><boxGeometry args={[1.2, 0.5 + i * 0.7, 8]} /><meshStandardMaterial color={colors.shell} /></mesh>)}</group>)}
    </>}
    {interior !== "sports" && [0, 1, 2].map(i => <group key={i} position={[interior === "library" ? 8 : -8, 0, -6 + i * 3]}>
      <mesh position={[0, 0.65, 0]} scale={[1.5, 0.7, 1]}><sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color={colors.glass} roughness={0.5} /></mesh>
      <mesh position={[-1.8, 0.7, 0]}><cylinderGeometry args={[0.65, 0.5, 1.4, 24]} /><meshStandardMaterial color={colors.shell} /></mesh>
      <mesh position={[-1.8, 1.45, 0]} rotation={[-0.3, 0, 0]}><boxGeometry args={[0.8, 0.05, 0.5]} /><meshStandardMaterial color={colors.metal} emissive={colors.light} emissiveIntensity={0.2} /></mesh>
    </group>)}
    {[-1, 1].map(side => <group key={side} position={[side * 10, 0, 5]}>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[1.4, 1.2, 0.5, 32]} /><meshStandardMaterial color={colors.shell} /></mesh>
      {[-0.6, 0, 0.6].map((x, i) => <mesh key={i} position={[x, 0.9, 0]} scale={[0.45, 1.2 + i * 0.3, 0.5]}><icosahedronGeometry args={[0.7, 2]} /><meshStandardMaterial color={colors.garden} roughness={0.9} /></mesh>)}
    </group>)}
  </>;
}