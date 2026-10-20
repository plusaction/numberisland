/** Juice helpers (SPEC §7.4): springs for squash & stretch, hit-stop, gentle camera shake. */

/** Damped spring toward a target (semi-implicit Euler, stable for dt ≤ 1/30). */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(
    initial = 0,
    public stiffness = 220,
    public damping = 14,
  ) {
    this.value = initial;
    this.target = initial;
  }
  /** Kick the spring (positive = stretch). */
  impulse(v: number) {
    this.velocity += v;
  }
  update(dt: number): number {
    const force = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  get settled(): boolean {
    return Math.abs(this.velocity) < 1e-3 && Math.abs(this.target - this.value) < 1e-3;
  }
}

/** Volume-preserving squash/stretch scale from a spring value s (s>0 stretch up, s<0 squash). */
export function squashScale(s: number): { x: number; y: number; z: number } {
  const y = 1 + s;
  const xz = 1 / Math.sqrt(Math.max(0.2, y));
  return { x: xz, y, z: xz };
}

/** Hit-stop: freezes visual time for a short moment (30–60 ms). Simulation keeps its own clock. */
export class HitStop {
  private left = 0;
  trigger(ms = 45) {
    this.left = Math.max(this.left, ms / 1000);
  }
  /** Returns the visual dt to use this frame. */
  filter(dt: number): number {
    if (this.left <= 0) return dt;
    this.left -= dt;
    return 0;
  }
}

/** Camera shake with trauma decay; amplitude is clamped tiny and disabled under reduced motion. */
export class Shake {
  private trauma = 0;
  private t = 0;
  constructor(public enabled = true) {}
  add(amount: number) {
    if (!this.enabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }
  update(dt: number): { x: number; y: number } {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const a = this.trauma * this.trauma * 0.05;
    return { x: Math.sin(this.t * 47) * a, y: Math.cos(this.t * 39) * a };
  }
}

/**
 * Photosensitivity guard (SPEC §14): at most 3 bright flashes per second. Callers ask before flashing.
 */
export class FlashGuard {
  private times: number[] = [];
  constructor(private readonly maxPerSecond = 3) {}
  allow(nowMs: number): boolean {
    this.times = this.times.filter((t) => nowMs - t < 1000);
    if (this.times.length >= this.maxPerSecond) return false;
    this.times.push(nowMs);
    return true;
  }
}
