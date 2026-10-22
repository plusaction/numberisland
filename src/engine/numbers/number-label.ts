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

/**
 * Number labels live on their own layer: tiers with screen-space effects draw them *after* post-processing,
 * so contact shadows and bloom never wash out the place-value colours and marks (P9).
 */
export const LABEL_LAYER = 2;

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
  m.userData.shared = true; // cached per glyph+tint: scene teardown must not dispose it
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
  /** Cream plate behind the number (default on): readable on any background. */
  badge?: boolean;
}

export class NumberLabel extends Group {
  private text = '';
  private opts: Required<Omit<NumberLabelOptions, 'hideIndex'>> & { hideIndex?: number };
  private badgeSprite: Sprite | null = null;

  constructor(value: number | string, opts: NumberLabelOptions = {}) {
    super();
    const badge = opts.badge ?? true;
    this.opts = {
      size: opts.size ?? 0.6,
      // on a cream badge plain digits are ink-coloured; without a badge they stay white
      tint: opts.tint ?? (badge ? PALETTE.ink : PALETTE.white),
      placeColors: opts.placeColors ?? false,
      badge,
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
    // tighter spacing so "15" reads as one number, not "1 5"
    const step = w * 0.86;
    const total = chars.length * step;
    const digitsOnly = /^\d+$/.test(text);
    if (this.opts.badge) {
      const b = new Sprite(glyphMaterial('BADGE', PALETTE.white));
      b.scale.set(total + size * 0.55, size * 1.55, 1);
      b.position.set(0, placeColors && digitsOnly ? -size * 0.18 : 0, 0);
      b.renderOrder = 1;
      b.layers.set(LABEL_LAYER);
      this.badgeSprite = b;
      this.add(b);
    }
    chars.forEach((ch, i) => {
      const placeIdx = chars.length - 1 - i;
      const g: Glyph = this.opts.hideIndex === i ? '□' : GLYPHS.includes(ch) ? ch : '?';
      const tintColor = placeColors && digitsOnly ? (PLACE_COLORS[Math.min(placeIdx, 3)] as string) : tint;
      const s = new Sprite(glyphMaterial(g, tintColor));
      s.scale.set(size * (CELL_W / CELL_H), size, 1);
      s.position.set(-total / 2 + step * (i + 0.5), 0, 0);
      s.renderOrder = 2;
      s.layers.set(LABEL_LAYER);
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
        const ms = size * 0.42;
        mark.scale.set(ms * (CELL_W / CELL_H), ms, 1);
        mark.position.set(-total / 2 + step * (i + 0.5), -size * 0.66, 0);
        mark.renderOrder = 2;
        mark.layers.set(LABEL_LAYER);
        this.add(mark);
      }
    });
  }
}
