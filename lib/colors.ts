// Helpers for working with the arbitrary pastel hex a group carries.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "cccccc", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** rgba string from a hex + alpha, for faint tinted backgrounds. */
export function tint(hex: string, alpha = 0.16): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick black or dark-ink text depending on how light the pastel is. */
export function readableText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // relative luminance
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? "#1F2933" : "#1F2933"; // pastels are always light -> dark ink
}

/** A slightly deeper version of the pastel for borders/dots. */
export function deepen(hex: string, amount = 0.82): string {
  const { r, g, b } = hexToRgb(hex);
  const d = (c: number) => Math.round(c * amount);
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

// A palette offered in the group editor. Soft, works on a white-ish canvas.
export const PASTEL_PALETTE = [
  "#AEDFF7", // sky
  "#C3E8C9", // mint
  "#FFD9C0", // peach
  "#E4C7F5", // lavender
  "#FFF3B0", // butter
  "#F7C5D9", // pink
  "#C7E9E4", // teal
  "#D9E4C7", // sage
  "#CBD5F5", // periwinkle
  "#F5D5C0", // apricot
];
