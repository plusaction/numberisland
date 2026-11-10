import { ko } from '../../i18n/ko';
import type { StageModule } from '../_shared/module';
import { type FishingAction, type FishingState, fishingRules, initFishing, solveFishing } from './rules';
import { createFishingScene } from './scene';

function goal(s: FishingState): string {
  const p = s.puzzle;
  if (!p) return '';
  if (p.mode === 'sum') return `🎣 ? + ? = ${p.target}`;
  if (p.mode === 'diff') return `🎣 ? − ? = ${p.target}`;
  const k = p.known ?? 0;
  if (p.op === '+') return p.blank === 0 ? `🎣 □ + ${k} = ${p.target}` : `🎣 ${k} + □ = ${p.target}`;
  return p.blank === 0 ? `🎣 □ − ${k} = ${p.target}` : `🎣 ${k} − □ = ${p.target}`;
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
  hud: (s) => ({
    canUndo: s.phase === 'play' && s.picked.length > 0,
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: goal(s),
    wrong: s.phase === 'bounce' ? s.lastWrong : null,
    success: s.phase === 'hook' || s.phase === 'reel',
    ...(s.phase === 'hook' ? { primary: { label: ko.stageHud.reel, left: s.reelLeft } } : {}),
    hintMode: s.puzzle && s.puzzle.mode !== 'missing' ? 'pair' : 'standard',
    ...(s.puzzle ? { target: s.puzzle.target, pairOp: s.puzzle.mode === 'diff' ? '-' : '+' } : {}),
  }),
  // only pair puzzles glow one *part*; in □ mode the single fish is the answer itself, so no glow
  glowTarget: (s) =>
    s.puzzle && s.puzzle.mode !== 'missing' ? (solveFishing(s.puzzle)[0]?.[0] ?? null) : null,
  solution: (s) =>
    s.phase === 'hook'
      ? Array.from({ length: s.reelLeft }, () => ({ t: 'reel' as const }))
      : s.puzzle
        ? (solveFishing(s.puzzle)[0] ?? []).map((id) => ({ t: 'tap' as const, id }))
        : [],
  hudKey: (s) => `${s.puzzle ? 1 : 0}|${s.picked.join(',')}|${s.reelLeft}`,
  hintAction: { t: 'hint' },
  undoAction: { t: 'undo' },
  primaryAction: { t: 'reel' },
  retryAction: { t: 'retry' },
};
