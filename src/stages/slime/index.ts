import type { StageModule } from '../_shared/module';
import { initSlime, isStuck, type SlimeAction, type SlimeState, slimeRules, solveSlime } from './rules';
import { createSlimeScene } from './scene';

/** One solving merge for the current tray (tutorial ghost hand + keyboard hints). */
function nextGoodMove(s: SlimeState): SlimeAction | null {
  const p = s.puzzle;
  if (!p) return null;
  const cur = solveSlime(p.target, s.slimes);
  if (cur === null) return null;
  for (const from of s.slimes) {
    for (const to of s.slimes) {
      if (from.id === to.id || to.minus) continue;
      const v = from.minus ? to.value - from.value : to.value + from.value;
      if (v < 0) continue;
      const after = s.slimes
        .filter((x) => x.id !== from.id)
        .map((x) => (x.id === to.id ? { ...x, value: v } : x));
      const d = v === p.target ? 0 : solveSlime(p.target, after);
      if (d !== null && d < cur) return { t: 'merge', from: from.id, to: to.id };
    }
  }
  return null;
}

export const slimeModule: StageModule<SlimeState, SlimeAction> = {
  id: 'slime',
  rules: { ...slimeRules, init: (seed, level, opts) => initSlime(seed, level, opts) },
  bgm: 'slime',
  createScene: createSlimeScene,
  keyboard: {
    targets: (s) => s.slimes.map((x) => x.id),
    // first confirm picks up a slime, second confirm drops it on another one
    confirm: (s, id, held) => {
      if (held === null || held === id) return { hold: held === id ? null : id };
      if (!s.slimes.some((x) => x.id === held)) return { hold: id };
      return { action: { t: 'merge', from: held, to: id }, hold: null };
    },
  },
  hud: (s) => ({
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: s.puzzle ? `🎯 ${s.puzzle.target}` : '',
    stuck: isStuck(s),
    wrong: null, // bounce/dead-end feedback is the wobble + the undo suggestion
    success: s.phase === 'win',
    canUndo: s.undo.length > 0,
  }),
  solution: (s) => {
    const m = nextGoodMove(s);
    return m ? [m] : [];
  },
  hintAction: { t: 'hint' },
  undoAction: { t: 'undo' },
};
