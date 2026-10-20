/** Palette from docs/ART_BIBLE.md — the single source for 3D colors. */
export const PALETTE = {
  sand: '#ffe3b3',
  sea: '#6fd0e3',
  leaf: '#8bd48f',
  berry: '#ff8fab',
  sun: '#ffd166',
  lavender: '#b9a6f2',
  peach: '#ffb38a',
  mint: '#a8ebd8',
  sky: '#bfe6ff',
  cocoa: '#8a6a5c',
  ink: '#3b3355',
  cream: '#fff8ec',
  white: '#ffffff',
} as const;

/** Place-value colors + shapes (global rule, SPEC §7.3): ones/tens/hundreds/thousands. */
export const PLACE_COLORS = ['#22a654', '#2f6fe8', '#8a46dc', '#d99a00'] as const;
export const PLACE_MARKS = ['●', '▬', '★', '◆'] as const;
