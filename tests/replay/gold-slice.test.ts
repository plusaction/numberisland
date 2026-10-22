import { describe, expect, it } from 'vitest';
import { CURRICULUM, levelSpec } from '../../src/domain/curriculum/curriculum';
import { generateQuestion } from '../../src/domain/edu/generate';
import type { LevelId } from '../../src/domain/edu/types';
import { createRng } from '../../src/domain/rng/rng';
import { type RoundOptions, stageLevel } from '../../src/stages/_shared/round';
import {
  BOMB_SKILLS,
  puzzleFromQuestion as bombPuzzle,
  bombRules,
  needed,
  preferBomb,
  selectionValid,
  solveBomb,
} from '../../src/stages/bomb/rules';
import {
  FISHING_SKILLS,
  fishingRules,
  puzzleFromQuestion as fishPuzzle,
  preferFishing,
  solveFishing,
} from '../../src/stages/fishing/rules';
import {
  preferSlime,
  SLIME_SKILLS,
  puzzleFromQuestion as slimePuzzle,
  slimeRules,
  solveSlime,
} from '../../src/stages/slime/rules';
import { BOTS, type BotPolicy } from '../../tools/autoplayer/policy';
import { bombBot, fishingBot, replay, slimeBot } from '../../tools/autoplayer/stages';

/** Stage rules accept the full round options (term, shift) at runtime; the domain type only names `puzzles`. */
const initWith = (rules: { init: unknown }) =>
  rules.init as (seed: string, level: LevelId, opts?: RoundOptions) => unknown;

const BAND_LEVELS: Record<'A' | 'B' | 'C', LevelId[]> = {
  A: ['A2', 'A3', 'A4'],
  B: ['B2', 'B3'],
  C: ['C2', 'C3', 'C4'],
};

function questionsFor(
  usable: readonly string[],
  prefer: (q: ReturnType<typeof generateQuestion>) => boolean,
  n: number,
) {
  const out: ReturnType<typeof generateQuestion>[] = [];
  const rng = createRng(`gen-${usable.join()}`);
  for (const level of CURRICULUM) {
    const lvl = stageLevel(level.id, usable as never, 0);
    const skills = levelSpec(lvl).skills.filter((s) => usable.includes(s));
    for (let i = 0; i < n; i++) {
      const q = generateQuestion({ level: lvl, skill: rng.pick(skills), rng });
      if (prefer(q)) out.push(q);
    }
  }
  return out;
}

describe('[G1:fishing] 낚시 해결 가능성·결정성', () => {
  it('every generated puzzle has ≥1 solution (all levels)', () => {
    const rng = createRng('fish-solve');
    for (const q of questionsFor(FISHING_SKILLS, preferFishing, 600)) {
      const p = fishPuzzle(q, rng);
      expect(solveFishing(p).length, q.id).toBeGreaterThanOrEqual(1);
      expect(p.fish.length).toBeGreaterThanOrEqual(6);
      for (const f of p.fish) {
        expect(f.value).toBeGreaterThanOrEqual(0);
        expect(f.value, q.id).toBeLessThanOrEqual(levelSpec(q.level).max);
      }
    }
  });
  it('replay of recorded input reproduces the exact final state', () => {
    const run = fishingBot('replay-1', 'A3', BOTS.p80);
    expect(run.final.phase).toBe('done');
    const again = replay(fishingRules.init('replay-1', 'A3'), fishingRules.step, run.frames, run.ticks);
    expect(again).toEqual(run.final);
  });
});

describe('[G1:bomb] 폭탄 해결 가능성·결정성', () => {
  it('every puzzle has ≥1 correct cut set; wrong sets never equal N', () => {
    const rng = createRng('bomb-solve');
    for (const q of questionsFor(BOMB_SKILLS, preferBomb, 400)) {
      const p = bombPuzzle(q, rng);
      const sols = solveBomb(p);
      expect(sols.length, q.id).toBeGreaterThanOrEqual(1);
      expect(p.wires.length).toBeGreaterThanOrEqual(needed(p));
      for (const w of p.wires) {
        expect(w.value).toBeGreaterThanOrEqual(p.mode === 'PLACE' ? 0 : 1); // "0 tens" wires exist in PLACE
        expect(w.value, q.id).toBeLessThanOrEqual(levelSpec(q.level).max);
      }
      // every non-solution cut set misses N (explicit, not only "a solution exists")
      const ok = new Set(sols.map((x) => x.join(',')));
      const k = needed(p);
      const ids = p.wires.map((w) => w.id);
      const all: number[][] = [];
      const rec = (st: number, acc: number[]) => {
        if (acc.length === k) return void all.push(acc);
        for (let i = st; i < ids.length; i++) rec(i + 1, [...acc, ids[i] as number]);
      };
      rec(0, []);
      for (const c of all) if (!ok.has(c.join(','))) expect(selectionValid(p, c)).toBe(false);
    }
  });
  it('replay reproduces the final state', () => {
    const run = bombBot('replay-2', 'B2', BOTS.p80);
    expect(run.final.phase).toBe('done');
    expect(replay(bombRules.init('replay-2', 'B2'), bombRules.step, run.frames, run.ticks)).toEqual(
      run.final,
    );
  });
});

describe('[G1:slime] 슬라임 해결 가능성·결정성', () => {
  it('backwards-generated puzzles are always solvable (BFS) and the target is not pre-made', () => {
    const rng = createRng('slime-solve');
    for (const q of questionsFor(SLIME_SKILLS, preferSlime, 250)) {
      const p = slimePuzzle(q, rng);
      const d = solveSlime(p.target, p.slimes);
      expect(d, q.id).not.toBeNull();
      for (const sl of p.slimes) expect(sl.value, q.id).toBeLessThanOrEqual(levelSpec(q.level).max);
      expect(d as number).toBeGreaterThanOrEqual(1);
    }
  });
  it('replay reproduces the final state', () => {
    const run = slimeBot('replay-3', 'A2', BOTS.p80);
    expect(run.final.phase).toBe('done');
    expect(replay(slimeRules.init('replay-3', 'A2'), slimeRules.step, run.frames, run.ticks)).toEqual(
      run.final,
    );
  });
});

type Bot = (
  seed: string,
  level: LevelId,
  p: BotPolicy,
) => { summary: { stars: number; cleared: boolean }; ticks: number; longWrongRuns: number };
const STAGES: [string, Bot][] = [
  ['fishing', fishingBot as Bot],
  ['bomb', bombBot as Bot],
  ['slime', slimeBot as Bot],
];

for (const [stage, bot] of STAGES) {
  describe(`[G3:${stage}] 두 전략 모두 클리어`, () => {
    it('strategy A and B both clear every band', () => {
      for (const band of ['A', 'B', 'C'] as const) {
        for (const strategy of ['A', 'B'] as const) {
          const r = bot(`g3-${band}-${strategy}`, BAND_LEVELS[band][0] as LevelId, { ...BOTS.p95, strategy });
          expect(r.summary.cleared, `${band}/${strategy}`).toBe(true);
        }
      }
    });
  });

  describe(`[G4:${stage}] 난이도 곡선`, () => {
    it('stars rise and time falls with accuracy; ≥4 wrongs in a row ≤ 5% of puzzles', () => {
      const res: Record<string, { stars: number; ticks: number; long: number; puzzles: number }> = {};
      for (const [name, policy] of Object.entries(BOTS)) {
        let stars = 0;
        let ticks = 0;
        let long = 0;
        const N = 12;
        for (let i = 0; i < N; i++) {
          const lvl = (['A3', 'B2', 'C3'] as LevelId[])[i % 3] as LevelId;
          const r = bot(`g4-${name}-${i}`, lvl, policy);
          expect(r.summary.cleared).toBe(true);
          stars += r.summary.stars;
          ticks += r.ticks;
          long += r.longWrongRuns;
        }
        res[name] = { stars: stars / N, ticks: ticks / N, long, puzzles: N * 8 };
      }
      const { p60, p80, p95 } = res as Record<
        'p60' | 'p80' | 'p95',
        { stars: number; ticks: number; long: number; puzzles: number }
      >;
      expect(p95.stars).toBeGreaterThanOrEqual(p80.stars);
      expect(p80.stars).toBeGreaterThanOrEqual(p60.stars);
      expect(p95.ticks).toBeLessThan(p60.ticks);
      expect(p60.long / p60.puzzles).toBeLessThanOrEqual(0.05);
      console.info(`[G4:${stage}]`, JSON.stringify(res));
    });
  });
}

describe('[E1] 밴드 변형 (A/B/C) — 스테이지 숫자 범위', () => {
  it('band B uses 3-digit and band C 4-digit targets somewhere; nothing exceeds the level ceiling', () => {
    for (const band of ['A', 'B', 'C'] as const) {
      let maxTarget = 0;
      for (const level of BAND_LEVELS[band]) {
        for (let i = 0; i < 8; i++) {
          for (const rules of [fishingRules, bombRules, slimeRules] as const) {
            // bands B/C stay supported for 2-1/2-2 settings; the default (grade 1) never reaches them
            const s = initWith(rules)(`band-${level}-${i}`, level, band === 'A' ? {} : { term: '2-2' }) as {
              puzzle: { target: number } | null;
              core: { asked: { question: { level: LevelId } } | null };
            };
            const t = s.puzzle?.target ?? 0;
            const lvl = s.core.asked?.question.level as LevelId;
            expect(t).toBeLessThanOrEqual(levelSpec(lvl).max);
            maxTarget = Math.max(maxTarget, t);
          }
        }
      }
      if (band === 'A') expect(maxTarget).toBeLessThanOrEqual(99);
      if (band === 'B') expect(maxTarget).toBeGreaterThanOrEqual(100);
      if (band === 'C') expect(maxTarget).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe('[E1] 초1 설정 — 어떤 스테이지도 1학년 범위를 넘지 않음', () => {
  it('even "harder" (+1) from a B/C level serves only L0_1–A6 content, never two-digit carrying', () => {
    const grade1 = new Set(['L0_1', 'A1', 'A2', 'A3', 'A4', 'A6']);
    for (const level of ['A4', 'A6', 'B2', 'C3'] as LevelId[]) {
      for (const shift of [-1, 0, 1] as const) {
        for (let i = 0; i < 6; i++) {
          for (const rules of [fishingRules, bombRules, slimeRules] as const) {
            const s = initWith(rules)(`g1-${level}-${shift}-${i}`, level, { shift }) as {
              core: { asked: { question: { level: LevelId; answer: number; operands: number[] } } | null };
            };
            const q = s.core.asked?.question;
            expect(q && grade1.has(q.level), `${level}/${shift} → ${q?.level}`).toBe(true);
            expect(Math.max(q?.answer ?? 0, ...(q?.operands ?? []))).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });
});
