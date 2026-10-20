/**
 * Fixed 60 Hz simulation + interpolated rendering (SPEC §6.3).
 * The accumulator is capped (no spiral of death) and the loop pauses while the tab is hidden.
 */
export const STEP = 1 / 60;
const MAX_FRAME = 0.25;

export interface LoopCallbacks {
  /** Advance the simulation by exactly STEP seconds. */
  update(dt: number, tick: number): void;
  /** Draw; alpha ∈ [0,1) is the interpolation factor between the last two simulation states. */
  render(alpha: number, frameDt: number): void;
}

export interface FixedLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  readonly tick: number;
  /** Frame time EMA in ms (for quality tiers / debug HUD). */
  readonly frameMs: number;
  /** Advance manually (tests, replays). */
  advance(seconds: number): void;
  dispose(): void;
}

export function createFixedLoop(
  cb: LoopCallbacks,
  raf = globalThis.requestAnimationFrame?.bind(globalThis),
): FixedLoop {
  let acc = 0;
  let last = -1;
  let tick = 0;
  let running = false;
  let handle = 0;
  let frameMs = 16.7;
  let hiddenPaused = false;

  const advance = (seconds: number) => {
    acc += Math.min(seconds, MAX_FRAME);
    while (acc >= STEP) {
      cb.update(STEP, tick);
      tick++;
      acc -= STEP;
    }
  };

  const frame = (now: number) => {
    if (!running) return;
    const t = now / 1000;
    const dt = last < 0 ? STEP : t - last;
    last = t;
    frameMs = frameMs * 0.9 + dt * 1000 * 0.1;
    advance(dt);
    cb.render(acc / STEP, dt);
    handle = raf ? raf(frame) : 0;
  };

  const onVisibility = () => {
    if (document.hidden && running) {
      hiddenPaused = true;
      stop();
    } else if (!document.hidden && hiddenPaused) {
      hiddenPaused = false;
      start();
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  function start() {
    if (running) return;
    running = true;
    last = -1;
    if (raf) handle = raf(frame);
  }
  function stop() {
    running = false;
    if (handle) globalThis.cancelAnimationFrame?.(handle);
    handle = 0;
  }

  return {
    start,
    stop,
    get running() {
      return running;
    },
    get tick() {
      return tick;
    },
    get frameMs() {
      return frameMs;
    },
    advance,
    dispose() {
      stop();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
