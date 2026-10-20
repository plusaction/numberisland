/**
 * Big readable 3D numbers (SPEC §7.3): billboard sprites from the digit atlas.
 * With `placeColors`, every digit is tinted by its place (일=초록, 십=파랑, 백=보라, 천=금색) and a shape
 * mark (● ▬ ★ ◆) sits under it, so colour is never the only cue.
 */

import { color, texture, uv, vec2 } from 'three/tsl';
import {
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Sprite,
  SpriteNodeMaterial,
  SRGBColorSpace,
} from 'three/webgpu';
import { PALETTE, PLACE_COLORS, PLACE_MARKS } from '../palette';
import { buildAtlasCanvas, CELL_H, CELL_W, GLYPHS, type Glyph } from './atlas';

let atlas: CanvasTexture | null = null;
const materials = new Map<string, SpriteNodeMaterial>();

/** Re-upload the atlas after a renderer was recreated (device/context loss). */
export async function refreshDigitAtlas(): Promise<void> {
  if (!atlas) return;
  const canvas = await buildAtlasCanvas();
  atlas.image = canvas as HTMLCanvasElement;
  atlas.needsUpdate = true;
}

export async function initDigitAtlas(): Promise<CanvasTexture> {
  if (atlas) return atlas;
  const canvas = await buildAtlasCanvas();
  atlas = new CanvasTexture(canvas as HTMLCanvasElement);
  atlas.colorSpace = SRGBColorSpace;
  atlas.minFilter = LinearFilter;
  atlas.generateMipmaps = false;
  return atlas;
}

function glyphMaterial(g: Glyph, tint: string): SpriteNodeMaterial {
  const key = `${g}|${tint}`;
  const cached = materials.get(key);
  if (cached) return cached;
  if (!atlas) throw new Error('digit atlas not initialised');
  const idx = GLYPHS.indexOf(g);
  const n = GLYPHS.length;
  // Numbers keep their exact palette colours: no tone mapping on glyphs (readability first).
  const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const t = texture(
    atlas,
    uv()
      .mul(vec2(1 / n, 1))
      .add(vec2(idx / n, 0)),
  );
  m.colorNode = t.rgb.mul(color(new Color(tint)));
  m.opacityNode = t.a;
  m.sizeAttenuation = true;
  materials.set(key, m);
  return m;
}

export interface NumberLabelOptions {
  /** Height of a digit in world units. */
  size?: number;
  tint?: string;
  placeColors?: boolean;
  /** Draw this char position as □ (missing term). */
  hideIndex?: number;
}

export class NumberLabel extends Group {
  private text = '';
  private opts: Required<Omit<NumberLabelOptions, 'hideIndex'>> & { hideIndex?: number };

  constructor(value: number | string, opts: NumberLabelOptions = {}) {
    super();
    this.opts = {
      size: opts.size ?? 0.6,
      tint: opts.tint ?? PALETTE.white,
      placeColors: opts.placeColors ?? false,
    };
    if (opts.hideIndex !== undefined) this.opts.hideIndex = opts.hideIndex;
    this.name = 'number-label';
    this.set(value);
  }

  get value(): string {
    return this.text;
  }

  set(value: number | string) {
    const text = String(value);
    if (text === this.text) return;
    this.text = text;
    for (const c of [...this.children]) this.remove(c);
    const { size, tint, placeColors } = this.opts;
    const w = size * (CELL_W / CELL_H) * 0.78;
    const chars = text.split('') as Glyph[];
    const total = chars.length * w;
    const digitsOnly = /^\d+$/.test(text);
    chars.forEach((ch, i) => {
      const placeIdx = chars.length - 1 - i;
      const g: Glyph = this.opts.hideIndex === i ? '□' : GLYPHS.includes(ch) ? ch : '?';
      const tintColor = placeColors && digitsOnly ? (PLACE_COLORS[Math.min(placeIdx, 3)] as string) : tint;
      const s = new Sprite(glyphMaterial(g, tintColor));
      s.scale.set(size * (CELL_W / CELL_H), size, 1);
      s.position.set(-total / 2 + w * (i + 0.5), 0, 0);
      s.center.set(0.5, 0.5);
      this.add(s);
      // shape mark under every digit (also single digits) so colour is never the only cue (P9)
      if (placeColors && digitsOnly) {
        const mark = new Sprite(
          glyphMaterial(
            PLACE_MARKS[Math.min(placeIdx, 3)] as Glyph,
            PLACE_COLORS[Math.min(placeIdx, 3)] as string,
          ),
        );
        const ms = size * 0.5;
        mark.scale.set(ms * (CELL_W / CELL_H), ms, 1);
        mark.position.set(-total / 2 + w * (i + 0.5), -size * 0.72, 0);
        this.add(mark);
      }
    });
  }
}
