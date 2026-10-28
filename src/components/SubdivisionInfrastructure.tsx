import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sceneColor } from "@/components/FuturisticHouse";

type Beam = { position: [number, number, number]; size: [number, number, number] };

function Beams({ items, color, lit = false }: { items: Beam[]; color: THREE.Color; lit?: boolean }) {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    items.forEach((item, index) => {
      transform.position.set(...item.position); transform.scale.set(...item.size); transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={!lit} receiveShadow={!lit}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color={color} metalness={0.45} roughness={0.55} emissive={color} emissiveIntensity={lit ? 1.1 : 0} />
  </instancedMesh>;
}

export default function SubdivisionInfrastructure() {
  const colors = useMemo(() => ({ deck: sceneColor("--printer-concrete"), metal: sceneColor("--printer-metal"), pedestrian: sceneColor("--walkway-light"), flight: sceneColor("--flight-beacon"), warning: sceneColor("--flight-warning") }), []);
  const { decks, rails, supports, lights } = useMemo(() => {
    const decks: Beam[] = [], rails: Beam[] = [], supports: Beam[] = [], lights: Beam[] = [];
    // Two pedestrian axes, above the roads and never above a house footprint.
    for (const axis of [0, 1]) {
      const p = (x: number, y: number, z: number): [number, number, number] => axis === 0 ? [x, y, z] : [z, y, x];
      const s = (x: number, y: number, z: number): [number, number, number] => axis === 0 ? [x, y, z] : [z, y, x];
      decks.push({ position: p(0, 4.1, 0), size: s(46, 0.22, 1.8) });
      for (const side of [-1, 1]) {
        rails.push({ position: p(0, 5, side * 0.85), size: s(46, 0.08, 0.08) });
        lights.push({ position: p(0, 4.28, side * 0.86), size: s(46, 0.045, 0.06) });
      }
      for (const x of [-22, -11, 11, 22]) {
        supports.push({ position: p(x, 2, 0), size: s(0.45, 4, 0.45) });
        for (const side of [-1, 1]) supports.push({ position: p(x, 4.55, side * 0.85), size: s(0.07, 0.9, 0.07) });
      }
      // Stair access outside the parcel grid.
      for (const side of [-1, 1]) for (let i = 0; i < 16; i++) {
        const height = (16 - i) * 0.25;
        decks.push({ position: p(side * (23.3 + i * 0.32), height / 2, 0), size: s(0.34, height, 1.8) });
      }
    }
    return { decks, rails, supports, lights };
  }, []);
  const arrow = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.24, -0.7); shape.lineTo(0.24, -0.7); shape.lineTo(0.24, 0.1);
    shape.lineTo(0.75, 0.1); shape.lineTo(0, 0.95); shape.lineTo(-0.75, 0.1); shape.lineTo(-0.24, 0.1); shape.closePath();
    return shape;
  }, []);
  return <group name="walkways-and-flight-signals">
    <Beams items={decks} color={colors.deck} />
    <Beams items={[...rails, ...supports]} color={colors.metal} />
    <Beams items={lights} color={colors.pedestrian} lit />
    {[-1, 1].flatMap(side => [0, 1].map(axis => <group key={`${side}-${axis}`} position={axis === 0 ? [side * 24, 0, 0] : [0, 0, side * 24]} rotation={[0, axis === 0 ? Math.PI / 2 : 0, 0]}>
      {[-2.2, 2.2].map(x => <group key={x}>
        <mesh position={[x, 4.7, 0]} castShadow><cylinderGeometry args={[0.12, 0.25, 9.4, 8]} /><meshStandardMaterial color={colors.metal} metalness={0.65} roughness={0.4} /></mesh>
        <mesh position={[x, 7.7, 0]}><cylinderGeometry args={[0.2, 0.2, 0.65, 12]} /><meshStandardMaterial color={colors.warning} emissive={colors.warning} emissiveIntensity={1.5} /></mesh>
      </group>)}
      <mesh position={[0, 9.4, 0]}><torusGeometry args={[1.8, 0.09, 8, 40]} /><meshStandardMaterial color={colors.flight} emissive={colors.flight} emissiveIntensity={1.4} /></mesh>
      <mesh position={[0, 9.4, 0]}><shapeGeometry args={[arrow]} /><meshStandardMaterial color={colors.flight} emissive={colors.flight} emissiveIntensity={0.9} side={THREE.DoubleSide} /></mesh>
    </group>))}
    {[-16.5, -5.5, 5.5, 16.5].flatMap(offset => [0, 1].map(axis => <mesh key={`aerial-${offset}-${axis}`} position={axis === 0 ? [offset, 9.4, 0] : [0, 9.4, offset]} rotation={[-Math.PI / 2, 0, axis === 0 ? -Math.PI / 2 : 0]}>
      <shapeGeometry args={[arrow]} /><meshBasicMaterial color={colors.flight} transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>))}
  </group>;
}