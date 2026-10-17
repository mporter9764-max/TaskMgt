/** 16 soft pastels for task groups (timeline bars use these as fills). */
export const GROUP_PALETTE = [
  "#cfe3f7", "#d6ecd2", "#f6d6e4", "#fbe5c4", "#e3dbf5", "#d3eeec",
  "#f7d9d2", "#f9f0c2", "#dfe7ec", "#e8e0d4", "#d8e8f5", "#e9d7ee",
  "#d9f0e0", "#fbd9d6", "#e2ecc9", "#d7dcf4",
];

/** Saturated identity colors for note tags and goal roles (fixed order, validated palette). */
export const TAG_PALETTE = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948",
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount);
}

/** Lighter, fully opaque version of a color (blends toward white). */
export function solidTint(hex: string, amount = 0.55): string {
  return mix(hex, [255, 255, 255], amount);
}

/** Darker version for borders and text on a pastel. */
export function deepen(hex: string, amount = 0.45): string {
  return mix(hex, [40, 40, 36], amount);
}

/** Translucent background from a color. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
