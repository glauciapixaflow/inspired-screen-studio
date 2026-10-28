import { urbanClearance } from "@/lib/neighborhood";

// Illustrative Martian topography, not surveyed elevation data.
export function terrainHeight(x: number, z: number) {
  const distance = urbanClearance(x, z);
  if (distance <= 0) return 0;
  const blend = Math.min(1, distance / 15);
  const smooth = blend * blend * (3 - 2 * blend);
  const peak = (cx: number, cz: number, height: number, width: number) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (width * width));
  const ridges = peak(-110, -85, 22, 20) + peak(-18, -120, 29, 17) + peak(45, -112, 20, 19)
    + peak(-125, 5, 18, 19) + peak(125, -20, 16, 20) + peak(95, 62, 12, 18);
  const craterRadius = Math.hypot(x + 53, z - 48);
  const crater = 7 * Math.exp(-(((craterRadius - 13) / 3.5) ** 2)) - 3 * Math.exp(-((craterRadius / 10) ** 2));
  const detail = (Math.sin(x * 0.23 + Math.cos(z * 0.18)) * Math.cos(z * 0.21) + Math.sin(x * 0.08 + z * 0.11)) * 1.5;
  return smooth * (ridges + crater + detail + 1.5);
}