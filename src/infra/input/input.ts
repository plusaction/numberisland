/**
 * Input manager: keyboard (event.code), gamepads (per player, rumble if supported).
 * Produces per-frame snapshots: `pressed` (edge) and `held`. Pointer picking is done by scenes.
 */
import { type Action, type BaseAction, KEYMAP_SOLO, type Keymap, PREVENT_DEFAULT } from './actions';

export interface ActionSnapshot {
  pressed: ReadonlySet<Action>;
  held: ReadonlySet<Action>;
}

const PAD_BUTTONS: [number, BaseAction][] = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
  [0, 'confirm'],
  [1, 'cancel'],
  [2, 'hint'],
  [3, 'undo'],
  [9, 'pause'],
];

export class InputManager {
  private held = new Set<Action>();
  private pressedQueue = new Set<Action>();
  private padPrev = new Map<number, Set<Action>>();
  private keymap: Keymap = KEYMAP_SOLO;
  private listeners: ((a: Action) => void)[] = [];
  /** Codes seen while held — for the parent "키보드 테스트" ghosting screen. */
  readonly heldCodes = new Set<string>();
  numLockOff = false;
  enabled = true;

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onDown, { passive: false });
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  setKeymap(map: Keymap) {
    this.keymap = map;
    this.held.clear();
  }

  /** Immediate callback for UI (menus) — gameplay should prefer `snapshot()`. */
  onAction(fn: (a: Action) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private onDown = (e: KeyboardEvent) => {
    this.heldCodes.add(e.code);
    if (e.code === 'Insert' || e.code === 'Delete') this.numLockOff = true;
    const action = this.keymap[e.code];
    const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (!inField && PREVENT_DEFAULT.has(e.code) && action) e.preventDefault();
    if (!this.enabled || !action || inField) return;
    if (!e.repeat) {
      this.pressedQueue.add(action);
      for (const l of this.listeners) l(action);
    }
    this.held.add(action);
  };

  private onUp = (e: KeyboardEvent) => {
    this.heldCodes.delete(e.code);
    const action = this.keymap[e.code];
    if (action) this.held.delete(action);
  };

  private onBlur = () => {
    this.held.clear();
    this.heldCodes.clear();
  };

  private pollPads() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const prefix = pad.index === 0 ? '' : 'p2.';
      const now = new Set<Action>();
      for (const [btn, a] of PAD_BUTTONS) if (pad.buttons[btn]?.pressed) now.add(`${prefix}${a}` as Action);
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -0.5) now.add(`${prefix}left` as Action);
      if (ax > 0.5) now.add(`${prefix}right` as Action);
      if (ay < -0.5) now.add(`${prefix}up` as Action);
      if (ay > 0.5) now.add(`${prefix}down` as Action);
      const prev = this.padPrev.get(pad.index) ?? new Set<Action>();
      for (const a of now) {
        if (!prev.has(a)) {
          this.pressedQueue.add(a);
          for (const l of this.listeners) l(a);
        }
        this.held.add(a);
      }
      for (const a of prev) if (!now.has(a)) this.held.delete(a);
      this.padPrev.set(pad.index, now);
    }
  }

  /** Call once per simulation tick. */
  snapshot(): ActionSnapshot {
    this.pollPads();
    const pressed = new Set(this.pressedQueue);
    this.pressedQueue.clear();
    return { pressed, held: new Set(this.held) };
  }

  rumble(player: 0 | 1, ms = 80) {
    const pad = navigator.getGamepads?.()[player];
    const actuator = pad?.vibrationActuator as
      | { playEffect?: (t: string, p: object) => Promise<unknown> }
      | undefined;
    void actuator
      ?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: 0.4, weakMagnitude: 0.6 })
      .catch(() => {});
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
