import { fmt, ko } from '../../i18n/ko';
import type { HudView, StageModule } from '../_shared/module';
import {
  crossChoices,
  initRace,
  placeOf,
  type RaceAction,
  type RaceState,
  raceRules,
  STAR_SQUARES,
  solveRace,
} from './rules';
import { createRaceScene } from './scene';

/** Goal line: the question as a number sentence (□ for a missing term). */
function goal(s: RaceState): string {
  const q = s.core.asked?.question;
  if (!q) return '🏁';
  const shown = s.phase === 'boost' || s.phase === 'finish';
  const hole =
    q.form === 'MISSING' && q.missingIndex !== undefined && q.missingIndex >= 0 ? q.missingIndex : -1;
  const parts: string[] = [];
  q.operands.forEach((n, i) => {
    if (i > 0) parts.push(q.ops[i - 1] === '-' ? '−' : '+');
    parts.push(i === hole ? (shown ? String(q.answer) : '□') : String(n));
  });
  parts.push('=', hole >= 0 ? String(q.result) : shown ? String(q.answer) : '?');
  return `🏁 ${parts.join(' ')}`;
}

function say(s: RaceState): HudView['say'] {
  const at = s.core.index;
  if (s.phase === 'finish')
    return { key: 'finish', text: s.place === 1 ? ko.race.win : fmt(ko.race.finish, { n: s.place ?? 2 }) };
  if (s.phase === 'slip') return { key: `slip-${s.core.wrong}`, text: ko.race.slip };
  if (s.phase === 'boost')
    return s.gain > 1
      ? { key: `turbo-${at}`, text: ko.race.turbo }
      : { key: `boost-${at}`, text: ko.race.boost };
  if (s.phase === 'start' || (at === 0 && s.me < 0.5)) return { key: 'intro', text: ko.race.intro };
  if (s.core.puzzles - s.me <= 2) return { key: 'near', text: ko.race.near };
  if (s.fuel < 0.2) return { key: `fuel-${at}`, text: ko.race.lowFuel };
  // a rival is in front: cheer the child on (no line while leading — the boosts speak for themselves)
  return placeOf(s.me, s.rivals) > 1 ? { key: 'behind', text: ko.race.behind } : undefined;
}

const DIRS = ['up', 'left', 'right', 'down'] as const;

export const raceModule: StageModule<RaceState, RaceAction> = {
  id: 'race',
  rules: { ...raceRules, init: (seed, level, opts) => initRace(seed, level, opts) },
  bgm: 'race',
  createScene: createRaceScene,
  keyboard: {
    targets: () => [],
    confirm: () => ({}),
    // ↑ ← → ↓ pick the answer in that slot of the cross at once
    direct: (s, dir) => {
      const q = s.core.asked?.question;
      const c = q ? crossChoices(q)[DIRS.indexOf(dir)] : undefined;
      return c ? { t: 'pick', value: c.value } : undefined;
    },
  },
  hud: (s) => {
    const q = s.core.asked?.question ?? null;
    const sayNow = say(s);
    return {
      core: s.core,
      question: q,
      goal: goal(s),
      wrong: s.phase === 'slip' ? s.lastWrong : null,
      success: s.phase === 'boost',
      hintMode: 'standard',
      ...(sayNow ? { say: sayNow } : {}),
      ...(s.phase === 'start' ? { cut: { key: 'ready', title: ko.race.ready } } : {}),
      ...(q && s.phase !== 'finish'
        ? { cross: { choices: crossChoices(q), tried: s.tried, off: s.phase !== 'play' } }
        : {}),
      race: {
        me: s.me,
        rivals: s.rivals,
        length: s.core.puzzles,
        place: s.place ?? placeOf(s.me, s.rivals),
        stars: STAR_SQUARES.filter((sq) => !s.stars.includes(sq)),
        fuel: s.phase === 'finish' ? 1 : s.fuel,
      },
    };
  },
  solution: (s) => (s.phase === 'play' || s.phase === 'start' ? solveRace(s) : []),
  hudKey: (s) =>
    // positions change every tick: quarter squares / tenths of fuel are enough for the mini track
    `${s.tried.length}|${Math.round(s.me * 4)}|${s.rivals.map((r) => Math.round(r * 4)).join(',')}|${Math.round(s.fuel * 10)}`,
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
  crossAction: (value) => ({ t: 'pick', value }),
  realtime: true,
};
