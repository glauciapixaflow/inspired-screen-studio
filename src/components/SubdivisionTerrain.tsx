import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { sceneColor } from "@/components/FuturisticHouse";
import { terrainHeight } from "@/lib/subdivision-terrain";

export default function SubdivisionTerrain({ texture }: { texture: THREE.Texture }) {
  const geometry = useMemo(() => {
    const mesh = new THREE.PlaneGeometry(240, 240, 120, 120);
    mesh.rotateX(-Math.PI / 2);
    const positions = mesh.getAttribute("position");
    const low = sceneColor("--printer-soil"), rock = sceneColor("--terrain-rock"), ridge = sceneColor("--terrain-ridge");
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const height = terrainHeight(x, z);
      positions.setY(i, height);
      const color = low.clone().lerp(rock, Math.min(0.8, Math.max(0, height / 22)));
      color.lerp(ridge, Math.max(0, height - 20) / 40);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    mesh.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.computeVertexNormals();
    return mesh;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow name="surrounding-martian-relief"><meshStandardMaterial map={texture} vertexColors roughness={1} /></mesh>;
}