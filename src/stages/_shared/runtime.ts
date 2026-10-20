/**
 * Runs a stage: queues actions from pointer/keyboard/HUD, steps the pure rules at 60 Hz,
 * syncs the 3D scene every frame and notifies the HUD when anything it shows changes.
 */
import type { InputFrame } from '../../domain/stage/types';
import type { RenderWorld } from '../../engine/world';
import type { ActionSnapshot } from '../../infra/input/input';
import type { PointerInfo, SceneController } from '../../scenes/common/controller';
import type { StageCtx, StageModule, StageScene } from './module';
import type { RoundCore } from './round';

export interface StageRuntime<S, A> extends SceneController {
  readonly state: S;
  dispatch(a: A): void;
  subscribe(fn: (s: S) => void): () => void;
  /** Recorded input (replay/debug). */
  readonly frames: InputFrame<A>[];
  /** Freeze input (tutorial demo). */
  locked: boolean;
  screenPos(targetId: number): { x: number; y: number } | null;
  /** Ticks between an input and the simulation step that consumed it. */
  readonly latencyTicks: number[];
  /**
   * Wall-clock ms from an input to the scene sync that shows/plays its reaction (G2: input → visual/audio).
   * Measured with performance.now() on the real frame loop.
   */
  readonly latencyMs: number[];
}

export function createStageRuntime<S extends { phase: string; core: RoundCore }, A>(
  mod: StageModule<S, A>,
  world: RenderWorld,
  init: S,
  ctx: StageCtx,
  onDone: (s: S) => void,
): StageRuntime<S, A> {
  let state = init;
  let prev: S | null = null;
  const queue: A[] = [];
  const subs = new Set<(s: S) => void>();
  const frames: InputFrame<A>[] = [];
  const latency: number[] = [];
  const latencyMs: number[] = [];
  let pendingAt: number | null = null;
  let consumedAt: number | null = null;
  const scene: StageScene<S, A> = mod.createScene(world, ctx);
  let cursor = 0;
  let held: number | null = null;
  let heldPuzzle = init.core.index;
  let finished = false;
  let pendingSince: number | null = null;

  const notify = () => {
    for (const fn of subs) fn(state);
  };
  const rt: StageRuntime<S, A> = {
    get state() {
      return state;
    },
    frames,
    latencyTicks: latency,
    latencyMs,
    locked: false,
    dispatch(a) {
      if (rt.locked || finished) return;
      queue.push(a);
      pendingSince ??= state.core.tick;
      pendingAt ??= performance.now();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    screenPos: (id) => scene.screenPos(state, id),
    update(_dt: number, input: ActionSnapshot) {
      if (state.core.index !== heldPuzzle) {
        // a slime held by keyboard never carries over into the next puzzle
        held = null;
        heldPuzzle = state.core.index;
      }
      if (!rt.locked && !finished) {
        const targets = mod.keyboard.targets(state);
        const move = (d: number) => {
          if (!targets.length) return;
          cursor = (cursor + d + targets.length) % targets.length;
          scene.setCursor(targets[cursor] ?? null, held);
        };
        if (input.pressed.has('left') || input.pressed.has('up')) move(-1);
        if (input.pressed.has('right') || input.pressed.has('down')) move(1);
        if (input.pressed.has('confirm') && targets.length) {
          const id = targets[Math.min(cursor, targets.length - 1)] as number;
          const r = mod.keyboard.confirm(state, id, held);
          held = r.hold ?? null;
          if (r.action) rt.dispatch(r.action);
          scene.setCursor(id, held);
        }
        if (input.pressed.has('hint')) rt.dispatch(mod.hintAction);
        if (input.pressed.has('undo') && mod.undoAction) rt.dispatch(mod.undoAction);
      }
      const actions = queue.splice(0, queue.length);
      if (actions.length && pendingAt !== null) {
        consumedAt = pendingAt;
        pendingAt = null;
      }
      const frame: InputFrame<A> = { tick: state.core.tick + 1, actions };
      if (actions.length) frames.push(frame);
      const before = state;
      state = mod.rules.step(state, frame);
      if (pendingSince !== null && actions.length) {
        latency.push(state.core.tick - pendingSince);
        pendingSince = null;
      }
      if (state !== before) notify();
      if (mod.rules.isDone(state) && !finished) {
        finished = true;
        onDone(state);
      }
    },
    pointer(p: PointerInfo) {
      if (rt.locked || finished) return;
      scene.pointer(p, state, rt.dispatch);
    },
    dispose() {
      scene.dispose();
      subs.clear();
    },
  };
  // render-rate sync lives in update's caller via world frame; we hook a light per-frame sync here
  const origUpdate = rt.update;
  rt.update = (dt, input) => {
    origUpdate(dt, input);
    scene.sync(state, prev, dt);
    if (consumedAt !== null) {
      latencyMs.push(performance.now() - consumedAt);
      consumedAt = null;
    }
    if (scene.setGlow)
      scene.setGlow(state.core.puzzleHints >= 3 && mod.glowTarget ? mod.glowTarget(state) : null);
    prev = state;
  };
  void world;
  return rt;
}
