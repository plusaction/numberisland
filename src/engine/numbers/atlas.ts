/**
 * Digit atlas (SPEC §7.3): 0–9, + − = □ ? and place-value marks (● ▬ ★ ◆), drawn once at boot on an
 * OffscreenCanvas (white fill + thick ink outline). Same drawing code as tools/gen-digit-atlas.ts.
 */
export const GLYPHS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '+',
  '-',
  '=',
  '□',
  '?',
  '●',
  '▬',
  '★',
  '◆',
] as const;
export type Glyph = (typeof GLYPHS)[number];
export const CELL_W = 128;
export const CELL_H = 160;
export const NUMBER_FONT = '"Fredoka", "Pretendard Variable", system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function star(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function shapePath(ctx: Ctx, g: Glyph, cx: number, cy: number): boolean {
  switch (g) {
    case '□':
      ctx.beginPath();
      ctx.roundRect(cx - 40, cy - 46, 80, 92, 14);
      return true;
    case '●':
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      return true;
    case '▬':
      ctx.beginPath();
      ctx.roundRect(cx - 40, cy - 13, 80, 26, 13);
      return true;
    case '★':
      star(ctx, cx, cy, 36);
      return true;
    case '◆':
      ctx.beginPath();
      ctx.moveTo(cx, cy - 36);
      ctx.lineTo(cx + 30, cy);
      ctx.lineTo(cx, cy + 36);
      ctx.lineTo(cx - 30, cy);
      ctx.closePath();
      return true;
    default:
      return false;
  }
}

export function drawAtlas(ctx: Ctx, ink = '#2d2545') {
  ctx.clearRect(0, 0, CELL_W * GLYPHS.length, CELL_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `700 120px ${NUMBER_FONT}`;
  GLYPHS.forEach((g, i) => {
    const cx = i * CELL_W + CELL_W / 2;
    const cy = CELL_H / 2 + 4;
    ctx.strokeStyle = ink;
    ctx.fillStyle = '#ffffff';
    if (shapePath(ctx, g, cx, cy)) {
      ctx.lineWidth = g === '□' ? 12 : 14;
      if (g === '□') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
      }
      ctx.stroke();
      ctx.fill();
      return;
    }
    const text = g === '-' ? '−' : g;
    ctx.lineWidth = 22;
    ctx.strokeText(text, cx, cy);
    ctx.fillText(text, cx, cy);
  });
}

export async function buildAtlasCanvas(): Promise<OffscreenCanvas | HTMLCanvasElement> {
  try {
    await document.fonts.load(`700 120px ${NUMBER_FONT}`, '0123456789+−=?');
  } catch {
    // fonts API unavailable: system font fallback is still legible
  }
  const w = CELL_W * GLYPHS.length;
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, CELL_H)
      : Object.assign(document.createElement('canvas'), { width: w, height: CELL_H });
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('2d context unavailable');
  drawAtlas(ctx);
  return canvas;
}
