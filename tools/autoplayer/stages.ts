/**
 * Headless bots for the Gold Slice stages (QUALITY96 §4.6). A bot is a policy (accuracy, reaction time,
 * strategy A/B) that turns a rules state into input frames; frames are recorded for replay tests.
 */
import type { LevelId } from '../../src/domain/edu/types';
import { createRng, type Rng } from '../../src/domain/rng/rng';
import type { InputFrame, RoundResult } from '../../src/domain/stage/types';
import { type BombAction, type BombState, bombRules, needed, solveBomb } from '../../src/stages/bomb/rules';
import {
  type FishingAction,
  type FishingState,
  fishingRules,
  solveFishing,
} from '../../src/stages/fishing/rules';
import { type SlimeAction, type SlimeState, slimeRules, solveSlime } from '../../src/stages/slime/rules';
import type { BotPolicy } from './policy';

export interface BotRun<S, A> {
  frames: InputFrame<A>[];
  final: S;
  summary: RoundResult;
  ticks: number;
  /** Puzzle indices where the bot failed ≥4 times in a row. */
  longWrongRuns: number;
}

const MAX_TICKS = 60 * 60 * 30;

function combos(ids: number[], k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) return void out.push(acc.slice());
    for (let i = start; i < ids.length; i++) rec(i + 1, [...acc, ids[i] as number]);
  };
  rec(0, []);
  return out;
}

function run<S extends { phase: string; core: { index: number; puzzleWrong: number } }, A>(
  init: S,
  step: (s: S, f: InputFrame<A>) => S,
  decide: (s: S, rng: Rng) => A[] | null,
  policy: BotPolicy,
  rng: Rng,
  summary: (s: S) => RoundResult,
): BotRun<S, A> {
  let s = init;
  const frames: InputFrame<A>[] = [];
  let queue: A[] = [];
  let wait = policy.reactionTicks;
  let tick = 0;
  let longWrongRuns = 0;
  let countedPuzzle = -1;
  while (s.phase !== 'done' && tick < MAX_TICKS) {
    tick++;
    let actions: A[] = [];
    if (queue.length) {
      actions = [queue.shift() as A];
    } else if (s.phase === 'play') {
      if (--wait <= 0) {
        const plan = decide(s, rng);
        if (plan?.length) {
          queue = plan;
          actions = [queue.shift() as A];
        }
        wait = policy.reactionTicks;
      }
    }
    const frame: InputFrame<A> = { tick, actions };
    if (actions.length) frames.push(frame);
    s = step(s, frame);
    if (s.core.puzzleWrong >= 4 && countedPuzzle !== s.core.index) {
      countedPuzzle = s.core.index;
      longWrongRuns++;
    }
  }
  return { frames, final: s, summary: summary(s), ticks: tick, longWrongRuns };
}

/** Replay recorded frames from the same seed (sparse frames: empty ticks in between). */
export function replay<S extends { phase: string }, A>(
  init: S,
  step: (s: S, f: InputFrame<A>) => S,
  frames: InputFrame<A>[],
  ticks: number,
): S {
  let s = init;
  let fi = 0;
  for (let t = 1; t <= ticks && s.phase !== 'done'; t++) {
    const f = frames[fi]?.tick === t ? frames[fi++] : { tick: t, actions: [] };
    s = step(s, f as InputFrame<A>);
  }
  return s;
}

export function fishingBot(seed: string, level: LevelId, policy: BotPolicy) {
  const rng = createRng(`bot-${seed}`);
  return run<FishingState, FishingAction>(
    fishingRules.init(seed, level),
    fishingRules.step,
    (s, r) => {
      const p = s.puzzle;
      if (!p) return null;
      const correct = solveFishing(p);
      const live = p.fish.filter((f) => !f.caught).map((f) => f.id);
      const k = p.mode === 'missing' ? 1 : 2;
      const key = (c: number[]) => c.slice().sort().join(',');
      const ok = new Set(correct.map(key));
      const wrong = combos(live, k).filter((c) => !ok.has(key(c)));
      // strategy A: biggest fish first; B: smallest fish first (both must clear)
      const sorted = correct.slice().sort((x, y) => {
        const v = (c: number[]) => Math.max(...c.map((id) => p.fish.find((f) => f.id === id)?.value ?? 0));
        return policy.strategy === 'A' ? v(y) - v(x) : v(x) - v(y);
      });
      const pick =
        sorted[0] && (wrong.length === 0 || r.chance(policy.accuracy))
          ? sorted[0]
          : r.pick(wrong.length ? wrong : correct);
      const acts: FishingAction[] = pick.map((id) => ({ t: 'tap', id }));
      if (s.odd && policy.strategy === 'B') acts.unshift({ t: 'odd' }); // B also grabs odd fish (coins)
      return acts;
    },
    policy,
    rng,
    fishingRules.summary,
  );
}

export function bombBot(seed: string, level: LevelId, policy: BotPolicy) {
  const rng = createRng(`bot-${seed}`);
  return run<BombState, BombAction>(
    bombRules.init(seed, level),
    bombRules.step,
    (s, r) => {
      const p = s.puzzle;
      if (!p) return null;
      const correct = solveBomb(p);
      const k = needed(p);
      const ids = p.wires.map((w) => w.id);
      const key = (c: number[]) => c.slice().sort().join(',');
      const ok = new Set(correct.map(key));
      let wrong = combos(ids, k).filter((c) => !ok.has(key(c)));
      if (p.mode === 'PLACE')
        wrong = wrong.filter(
          (c) => new Set(c.map((id) => p.wires.find((w) => w.id === id)?.group)).size === k,
        );
      // strategy A: cut wires in id order; B: cut the biggest wire first (for PLACE: high place → low place)
      const order = (c: number[]) =>
        policy.strategy === 'A'
          ? c
          : c
              .slice()
              .sort(
                (x, y) =>
                  (p.wires.find((w) => w.id === y)?.value ?? 0) -
                  (p.wires.find((w) => w.id === x)?.value ?? 0),
              );
      const pick =
        correct[0] && (wrong.length === 0 || r.chance(policy.accuracy))
          ? r.pick(correct)
          : r.pick(wrong.length ? wrong : correct);
      return order(pick).map((id) => ({ t: 'cut', id }));
    },
    policy,
    rng,
    bombRules.summary,
  );
}

export function slimeBot(seed: string, level: LevelId, policy: BotPolicy) {
  const rng = createRng(`bot-${seed}`);
  return run<SlimeState, SlimeAction>(
    slimeRules.init(seed, level),
    slimeRules.step,
    (s, r) => {
      const p = s.puzzle;
      if (!p) return null;
      const target = p.target;
      const cur = solveSlime(target, s.slimes);
      if (cur === null) return [{ t: 'undo' }];
      const moves: { from: number; to: number; good: boolean; minusFirst: boolean }[] = [];
      for (const from of s.slimes) {
        for (const to of s.slimes) {
          if (from.id === to.id || to.minus) continue;
          const v = from.minus ? to.value - from.value : to.value + from.value;
          if (v < 0) continue;
          const after = s.slimes
            .filter((x) => x.id !== from.id)
            .map((x) => (x.id === to.id ? { ...x, value: v } : x));
          const d = v === target ? 0 : solveSlime(target, after);
          moves.push({ from: from.id, to: to.id, good: d !== null && d < cur, minusFirst: from.minus });
        }
      }
      const good = moves.filter((m) => m.good);
      const bad = moves.filter((m) => !m.good);
      // strategy A: additions first; B: use minus slimes first when they help
      good.sort((x, y) =>
        policy.strategy === 'B'
          ? Number(y.minusFirst) - Number(x.minusFirst)
          : Number(x.minusFirst) - Number(y.minusFirst),
      );
      const m =
        good[0] && (bad.length === 0 || r.chance(policy.accuracy))
          ? good[0]
          : r.pick(bad.length ? bad : good);
      return [{ t: 'merge', from: m.from, to: m.to }];
    },
    policy,
    rng,
    slimeRules.summary,
  );
}
