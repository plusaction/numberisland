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
    targets: (s) => s.puzzle?.fish.filter((f) => !f.caught).map((f) => f.id) ?? [],
    confirm: (_s, id) => ({ action: { t: 'tap', id } }),
  },
  hud: (s) => ({
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: goal(s),
    wrong: s.phase === 'bounce' ? s.lastWrong : null,
    success: s.phase === 'reel',
    hintMode: s.puzzle && s.puzzle.mode !== 'missing' ? 'pair' : 'standard',
    ...(s.puzzle ? { target: s.puzzle.target, pairOp: s.puzzle.mode === 'diff' ? '-' : '+' } : {}),
  }),
  glowTarget: (s) => (s.puzzle ? (solveFishing(s.puzzle)[0]?.[0] ?? null) : null),
  solution: (s) =>
    s.puzzle ? (solveFishing(s.puzzle)[0] ?? []).map((id) => ({ t: 'tap' as const, id })) : [],
  hintAction: { t: 'hint' },
};
