let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/** Pixel width of text in the timeline bar font. Falls back to an estimate during SSR. */
export function textWidth(text: string, font = "500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"): number {
  const k = font + "|" + text;
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return text.length * 6.8;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 6.8;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width);
  cache.set(k, w);
  return w;
}
