import type { StageModule } from '../_shared/module';
import { type BombAction, type BombState, bombRules, initBomb, solveBomb } from './rules';
import { createBombScene } from './scene';

function goal(s: BombState): string {
  const p = s.puzzle;
  if (!p) return '';
  switch (p.mode) {
    case 'SUM2':
      return `💣 ? + ? = ${p.target}`;
    case 'DIFF2':
      return `💣 ? − ? = ${p.target}`;
    case 'SUM3':
      return `💣 ? + ? + ? = ${p.target}`;
    case 'PLACE':
      return `💣 ${p.target}`;
  }
}

export const bombModule: StageModule<BombState, BombAction> = {
  id: 'bomb',
  rules: { ...bombRules, init: (seed, level, opts) => initBomb(seed, level, opts) },
  bgm: 'bomb',
  createScene: createBombScene,
  keyboard: {
    targets: (s) => s.puzzle?.wires.map((w) => w.id) ?? [],
    confirm: (_s, id) => ({ action: { t: 'cut', id } }),
  },
  hud: (s) => ({
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: goal(s),
    wrong: s.phase === 'puff' ? s.lastWrong : null,
    success: s.phase === 'defuse',
  }),
  solution: (s) => (s.puzzle ? (solveBomb(s.puzzle)[0] ?? []).map((id) => ({ t: 'cut' as const, id })) : []),
  hintAction: { t: 'hint' },
};
