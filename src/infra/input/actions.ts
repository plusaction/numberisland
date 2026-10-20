/** Action map (SPEC §8.1): every control is an action; keys always by `event.code`. */
export type Player = 'p1' | 'p2';
export type BaseAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'hint' | 'undo' | 'pause';
export type Action = BaseAction | `p2.${BaseAction}`;

export type Keymap = Record<string, Action>;

/** Single-player defaults (arrows + WASD + Enter/Space). */
export const KEYMAP_SOLO: Keymap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  Backspace: 'undo',
  KeyH: 'hint',
  KeyP: 'pause',
};

/** 2P preset A: P1 A/S/D/F, P2 J/K/L/; (four buttons each = 4-choice cross). */
export const KEYMAP_2P_A: Keymap = {
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'up',
  KeyF: 'right',
  KeyJ: 'p2.left',
  KeyK: 'p2.down',
  KeyL: 'p2.up',
  Semicolon: 'p2.right',
  Escape: 'cancel',
};

/** 2P preset B (default): P1 WASD + J/K, P2 arrows + Numpad0/NumpadDecimal (NumLock off → Insert/Delete). */
export const KEYMAP_2P_B: Keymap = {
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
  KeyJ: 'confirm',
  KeyK: 'cancel',
  ArrowUp: 'p2.up',
  ArrowLeft: 'p2.left',
  ArrowDown: 'p2.down',
  ArrowRight: 'p2.right',
  Numpad0: 'p2.confirm',
  NumpadDecimal: 'p2.cancel',
  Insert: 'p2.confirm',
  Delete: 'p2.cancel',
  Escape: 'pause',
};

/** Codes whose browser default (scroll, back, zoom) must be prevented while playing. */
export const PREVENT_DEFAULT = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Backspace',
  'Numpad0',
  'NumpadDecimal',
  'Insert',
  'Delete',
]);

/** Cross layout for 4-choice answers: ↑ ← → ↓ map to choice slots 0..3. */
export const CROSS_SLOTS: Record<'up' | 'left' | 'right' | 'down', 0 | 1 | 2 | 3> = {
  up: 0,
  left: 1,
  right: 2,
  down: 3,
};
