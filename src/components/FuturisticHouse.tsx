import { useMemo } from "react";
import * as THREE from "three";

export function sceneColor(token: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Color();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function roundedOutline(x: number, y: number, w: number, h: number, r: number) {
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// A generated, print-ready capsule: the identical geometry is used on the parcel.
export default function FuturisticHouse({ progress = 1 }: { progress?: number }) {
  const colors = useMemo(() => ({ shell: sceneColor("--printer-concrete"), metal: sceneColor("--printer-metal"), glass: sceneColor("--printer-glass"), light: sceneColor("--habitat-light"), solar: sceneColor("--habitat-solar") }), []);
  const { shell, glass, rib, texture } = useMemo(() => {
    const shell = roundedOutline(-2.4, 0.28, 4.8, 2.9, 0.85);
    const opening = roundedOutline(-2.12, 0.56, 4.24, 2.34, 0.6);
    shell.holes.push(new THREE.Path(opening.getPoints().reverse()));
    const rib = roundedOutline(-2.46, 0.23, 4.92, 3.02, 0.91);
    rib.holes.push(new THREE.Path(roundedOutline(-2.35, 0.34, 4.7, 2.8, 0.8).getPoints().reverse()));
    const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 16, 64); ctx.fillStyle = "#d9d9d9"; for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 16, 1); }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 4);
    return { shell, glass: opening, rib, texture };
  }, []);
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  clip.constant = 0.28 + progress * 3.05;
  const clippingPlanes = progress < 1 ? [clip] : [];
  const material = { color: colors.shell, roughness: 0.48, metalness: 0.18, clippingPlanes };
  return <group name="futuristic-habitat">
    <mesh position={[0, 0.13, 0.35]} receiveShadow><boxGeometry args={[5.5, 0.26, 4.8]} /><meshStandardMaterial color={colors.metal} roughness={0.6} /></mesh>
    <mesh position={[0, 0, -1.65]} castShadow receiveShadow><extrudeGeometry args={[shell, { depth: 3.3, bevelEnabled: false, curveSegments: 20 }]} /><meshStandardMaterial {...material} bumpMap={texture} bumpScale={0.025} side={THREE.DoubleSide} /></mesh>
    {[-1.65, -0.7, 0.7, 1.65].map(z => <mesh key={z} position={[0, 0, z]} castShadow><extrudeGeometry args={[rib, { depth: 0.07, bevelEnabled: false, curveSegments: 20 }]} /><meshStandardMaterial {...material} /></mesh>)}
    <mesh position={[0, 0, -1.64]}><shapeGeometry args={[glass, 20]} /><meshStandardMaterial {...material} /></mesh>
    <group visible={progress >= 0.88}>
      <mesh position={[0, 0, 1.66]}><shapeGeometry args={[glass, 20]} /><meshPhysicalMaterial color={colors.glass} metalness={0.55} roughness={0.1} clearcoat={1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.36, 1.7]}><boxGeometry args={[0.82, 1.62, 0.08]} /><meshStandardMaterial color={colors.metal} metalness={0.7} roughness={0.25} /></mesh>
      {[-0.5, 0.5].map(x => <mesh key={x} position={[x, 1.5, 1.72]}><boxGeometry args={[0.035, 1.95, 0.03]} /><meshStandardMaterial color={colors.light} emissive={colors.light} emissiveIntensity={1.2} /></mesh>)}
      {[-1.2, 0, 1.2].map(x => <mesh key={x} position={[x, 3.2, -0.1]} rotation={[-0.08, 0, 0]} castShadow><boxGeometry args={[1.04, 0.065, 1.8]} /><meshStandardMaterial color={colors.solar} metalness={0.7} roughness={0.25} /></mesh>)}
      {[0, 1, 2].map(i => <mesh key={i} position={[0, 0.09 - i * 0.025, 2.9 + i * 0.35]} receiveShadow><boxGeometry args={[1.5 + i * 0.25, 0.1, 0.35]} /><meshStandardMaterial color={colors.shell} /></mesh>)}
      <mesh position={[0, 0.3, 2.12]}><boxGeometry args={[4.5, 0.035, 0.035]} /><meshStandardMaterial color={colors.light} emissive={colors.light} emissiveIntensity={0.8} /></mesh>
    </group>
  </group>;
}