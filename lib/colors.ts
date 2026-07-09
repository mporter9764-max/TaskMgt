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

/** A fully OPAQUE light version of a color, blended toward white. Unlike
 * tint(), nothing behind this can show through — use it for any sticky
 * background that scrolling content passes underneath (e.g. a sticky label
 * column next to a horizontally-scrolling timeline). */
export function solidTint(hex: string, amount = 0.78): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
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
  "#CBD5F5", // periwinkle
  "#C3E8C9", // mint
  "#D9E4C7", // sage
  "#C7E9E4", // teal
  "#A8E0E8", // aqua
  "#FFF3B0", // butter
  "#FCE1A8", // gold
  "#FFD9C0", // peach
  "#F5D5C0", // apricot
  "#FFC9C9", // light red
  "#FFB7A7", // coral
  "#F7C5D9", // pink
  "#F9C6D3", // rose
  "#E4C7F5", // lavender
  "#D7B8E8", // orchid
];

// A more saturated, hue-diverse palette for note tags — these need to be told
// apart quickly in a list, so more separation between colors matters more
// than the restrained pastel look used for timeline groups.
export const NOTE_TAG_PALETTE = [
  "#F87171", // red
  "#FB923C", // orange
  "#FBBF24", // amber
  "#A3E635", // lime
  "#4ADE80", // green
  "#34D399", // emerald
  "#2DD4BF", // teal
  "#22D3EE", // cyan
  "#38BDF8", // sky
  "#60A5FA", // blue
  "#818CF8", // indigo
  "#A78BFA", // violet
  "#C084FC", // purple
  "#E879F9", // fuchsia
  "#F472B6", // pink
  "#FB7185", // rose
  "#94A3B8", // slate
  "#EAB308", // yellow
];
