import { ko } from '../../i18n/ko';
import type { StageModule } from '../_shared/module';
import { isFinale } from '../_shared/round';
import {
  FISHING_PHASES,
  FISHING_PHASES_INITIAL,
  type FishingAction,
  type FishingState,
  fishingRules,
  initFishing,
  solveFishing,
} from './rules';
import { createFishingScene } from './scene';

/**
 * The goal sentence at the top, filled in as the child picks fish: each picked number drops into the next
 * "?" (□) box. After a right answer it shows the whole sentence; after a miss, a TRUE sentence of what the
 * picks really make (never a false "= target").
 */
function goal(s: FishingState): string {
  const p = s.puzzle;
  if (!p) return '';
  const val = (id: number) => p.fish.find((f) => f.id === id)?.value;
  const ids = s.phase === 'hook' || s.phase === 'reel' ? s.reeled : s.picked;
  const vals = ids.map(val).filter((v): v is number => v !== undefined);
  const miss = s.phase === 'bounce' && s.lastWrong ? s.lastWrong.made : null;
  const rhs = miss ?? p.target;
  if (p.mode === 'missing') {
    const k = p.known ?? 0;
    const box = vals[0] !== undefined ? String(vals[0]) : '□';
    const op = p.op === '+' ? '+' : '−';
    return p.blank === 0 ? `🎣 ${box} ${op} ${k} = ${rhs}` : `🎣 ${k} ${op} ${box} = ${rhs}`;
  }
  // a difference reads bigger − smaller once both are picked (like the bomb's wires)
  const shown = p.mode === 'diff' && vals.length === 2 ? [...vals].sort((a, b) => b - a) : vals;
  const slot = (i: number) => (shown[i] !== undefined ? String(shown[i]) : '?');
  return `🎣 ${slot(0)} ${p.mode === 'diff' ? '−' : '+'} ${slot(1)} = ${rhs}`;
}

export const fishingModule: StageModule<FishingState, FishingAction> = {
  id: 'fishing',
  rules: { ...fishingRules, init: (seed, level, opts) => initFishing(seed, level, opts) },
  bgm: 'fishing',
  createScene: createFishingScene,
  keyboard: {
    // the odd fish (id 1000) is reachable by keyboard too while it swims by
    targets: (s) =>
      s.phase === 'hook'
        ? s.reeled.slice(0, 1)
        : [...(s.puzzle?.fish.filter((f) => !f.caught).map((f) => f.id) ?? []), ...(s.odd ? [1000] : [])],
    confirm: (s, id) => ({
      action: s.phase === 'hook' ? { t: 'reel' } : id === 1000 ? { t: 'odd' } : { t: 'tap', id },
    }),
  },
  // picked fish numbers fly up into the goal sentence (the same as the bomb's wires)
  picks: (s) => s.picked,
  pickValue: (s, id) => s.puzzle?.fish.find((f) => f.id === id)?.value,
  hud: (s) => ({
    canUndo: s.phase === 'play' && s.picked.length > 0,
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: goal(s),
    wrong: s.phase === 'bounce' ? s.lastWrong : null,
    success: s.phase === 'hook' || s.phase === 'reel',
    ...(s.phase === 'hook'
      ? { primary: { label: ko.stageHud.reel, left: s.reelLeft } }
      : s.bonus === 1 && s.phase === 'play'
        ? { primary: { label: ko.stageHud.moveOn, left: 0 } }
        : {}),
    ...(s.bonus === 1 && (s.phase === 'play' || s.phase === 'bounce')
      ? { say: { key: `bonus-${s.core.index}`, text: ko.stageHud.secondPair } }
      : {}),
    hintMode: s.puzzle && s.puzzle.mode !== 'missing' ? 'pair' : 'standard',
    ...(s.puzzle ? { target: s.puzzle.target, pairOp: s.puzzle.mode === 'diff' ? '-' : '+' } : {}),
  }),
  // only pair puzzles glow one *part*; in □ mode the single fish is the answer itself, so no glow
  glowTarget: (s) =>
    s.puzzle && s.puzzle.mode !== 'missing' && s.bonus === 0
      ? (solveFishing(s.puzzle)[0]?.[0] ?? null)
      : null,
  solution: (s) =>
    s.phase === 'hook'
      ? Array.from({ length: s.reelLeft }, () => ({ t: 'reel' as const }))
      : s.bonus === 1
        ? // the second pair is optional: the shortest way on is the big key
          [{ t: 'reel' as const }]
        : s.puzzle
          ? (solveFishing(s.puzzle)[0] ?? []).map((id) => ({ t: 'tap' as const, id }))
          : [],
  phases: FISHING_PHASES,
  initialPhase: FISHING_PHASES_INITIAL,
  hudKey: (s) => `${s.puzzle ? 1 : 0}|${s.picked.join(',')}|${s.reelLeft}|${s.bonus}`,
  finale: (s) => isFinale(s.core),
  hintAction: { t: 'hint' },
  undoAction: { t: 'undo' },
  primaryAction: { t: 'reel' },
  retryAction: { t: 'retry' },
};
