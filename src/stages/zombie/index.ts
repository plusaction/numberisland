import { fmt, ko } from '../../i18n/ko';
import type { HudView, StageModule } from '../_shared/module';
import { HAND, initZombie, solveZombie, type ZombieAction, type ZombieState, zombieRules } from './rules';
import { createZombieScene } from './scene';

const eqText = (e: NonNullable<ZombieState['eq']>) =>
  `${e.from} ${e.delta < 0 ? '−' : '+'} ${Math.abs(e.delta)} = ${e.to}`;

/** Goal line: bring the balloon to 0 (`🎈 13 − ? = 0`); the last sum shows while a card lands. */
function goal(s: ZombieState): string {
  const z = s.zombie;
  if (!z) return '🎈';
  if ((s.phase === 'hit' || s.phase === 'pop') && s.eq) return `🎈 ${eqText(s.eq)}`;
  return `🎈 ${z.value} − ? = 0`;
}

function say(s: ZombieState): HudView['say'] {
  const z = s.zombie;
  if (!z) return undefined;
  const at = s.core.index;
  if (s.phase === 'pop' && s.eq)
    return at + 1 >= s.core.puzzles
      ? { key: 'party', text: ko.zombie.party }
      : { key: `pop-${at}`, text: fmt(ko.zombie.pop, { eq: eqText(s.eq) }) };
  if (s.phase === 'knock') return { key: `knock-${s.knocks}`, text: ko.zombie.knock };
  if (s.phase === 'nope')
    return {
      key: `nope-${s.core.wrong}`,
      text: fmt(ko.zombie.nope, { n: z.value, k: Math.abs(s.hand[s.slot] ?? 0) }),
    };
  if (s.phase === 'hit' && s.eq)
    return { key: `hit-${at}-${z.used}`, text: fmt(ko.zombie.hit, { eq: eqText(s.eq), n: z.value }) };
  if (at === 0 && z.used === 0) return { key: 'intro', text: ko.zombie.intro };
  if (z.boss && z.used === 0) return { key: 'boss', text: ko.zombie.boss };
  return { key: `ask-${at}-${z.used}`, text: fmt(ko.zombie.ask, { n: z.value }) };
}

export const zombieModule: StageModule<ZombieState, ZombieAction> = {
  id: 'zombie',
  rules: { ...zombieRules, init: (seed, level, opts) => initZombie(seed, level, opts) },
  bgm: 'zombie',
  createScene: createZombieScene,
  keyboard: {
    targets: () => Array.from({ length: HAND }, (_, i) => i),
    confirm: (_s, id) => ({ action: { t: 'card', id } }),
  },
  hud: (s) => {
    const sayNow = say(s);
    return {
      core: s.core,
      question: s.core.asked?.question ?? null,
      goal: goal(s),
      wrong: null,
      success: s.phase === 'pop',
      hintMode: 'standard',
      ...(sayNow ? { say: sayNow } : {}),
      ...(s.phase === 'wave'
        ? {
            cut: {
              key: `wave-${s.wave}`,
              title: s.zombie?.boss ? ko.zombie.bossWave : fmt(ko.zombie.wave, { i: s.wave + 1 }),
            },
          }
        : {}),
    };
  },
  hudKey: (s) => `${s.zombie?.value ?? ''}|${s.zombie?.used ?? 0}|${s.hand.join(',')}|${s.knocks}`,
  // hint step 3+: a card of the shortest finish sparkles
  glowTarget: (s) => solveZombie(s).map((a) => (a.t === 'card' ? a.id : null))[0] ?? null,
  solution: (s) => (s.phase === 'play' || s.phase === 'wave' ? solveZombie(s) : []),
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
  // the zombies walk in real time: they wait while a hint is being read
  realtime: true,
};
