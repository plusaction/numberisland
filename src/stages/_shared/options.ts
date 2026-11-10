/** Answer keys for "pick one of N" stages: the answer + near misses (the question's misconceptions first). */
import type { Question } from '../../domain/edu/types';
import type { Rng } from '../../domain/rng/rng';

/**
 * `count` different numbers in [min, 99], ascending, always containing `answer`: first the question's own
 * wrong choices (each one a typical mistake), then close neighbours (±1, ±2, ±10) to fill up.
 */
export function answerOptions(q: Question, answer: number, rng: Rng, count: number, min = 0): number[] {
  const opts = new Set<number>([answer]);
  for (const c of rng.shuffle(q.choices.map((x) => x.value)))
    if (opts.size < count && c !== answer && c >= min && c <= 99) opts.add(c);
  for (const d of rng.shuffle([1, -1, 10, -10, 2, -2]))
    if (opts.size < count && answer + d >= min && answer + d <= 99) opts.add(answer + d);
  return [...opts].sort((a, b) => a - b);
}
