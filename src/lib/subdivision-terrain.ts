// Illustrative Martian topography, not surveyed elevation data.
export function terrainHeight(x: number, z: number) {
  const distance = Math.max(Math.abs(x), Math.abs(z));
  if (distance <= 30) return 0;
  const blend = Math.min(1, (distance - 30) / 15);
  const smooth = blend * blend * (3 - 2 * blend);
  const peak = (cx: number, cz: number, height: number, width: number) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (width * width));
  const ridges = peak(-52, -50, 22, 20) + peak(-18, -65, 29, 17) + peak(25, -57, 20, 19)
    + peak(-66, 5, 18, 19) + peak(62, -20, 16, 20) + peak(70, 52, 12, 18);
  const craterRadius = Math.hypot(x + 53, z - 48);
  const crater = 7 * Math.exp(-((craterRadius - 13) / 3.5) ** 2) - 3 * Math.exp(-(craterRadius / 10) ** 2);
  const detail = (Math.sin(x * 0.23 + Math.cos(z * 0.18)) * Math.cos(z * 0.21) + Math.sin(x * 0.08 + z * 0.11)) * 1.5;
  return smooth * (ridges + crater + detail + 1.5);
}