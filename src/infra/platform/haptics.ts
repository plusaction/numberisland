/**
 * A short buzz where the device can (Android Chrome; iOS Safari has no vibration API) — the press feel.
 * Off with the "진동" setting; never a pattern long enough to startle.
 */
let enabled = true;

export function setHaptics(on: boolean) {
  enabled = on;
}

const PATTERNS = { tap: 8, good: 22, oops: [12, 60, 12] } as const;

export function buzz(kind: keyof typeof PATTERNS = 'tap') {
  if (!enabled) return;
  try {
    (globalThis.navigator as Navigator | undefined)?.vibrate?.(PATTERNS[kind] as number | number[]);
  } catch {
    // some browsers throw before a user gesture: the press still works, just silently
  }
}
