/**
 * Gentle rest reminder (SPEC §12 well-being): after `minutes` of play since the last reminder, the island
 * suggests resting the eyes. It never blocks play and nothing counts down (no pressure).
 */
export function restDue(nowMs: number, sinceMs: number, minutes: number): boolean {
  return minutes > 0 && nowMs - sinceMs >= minutes * 60_000;
}
