import { ko } from '../../i18n/ko';
import type { HudView, StageModule } from '../_shared/module';
import {
  bestPlay,
  type CardAction,
  type CardState,
  cardRules,
  distance,
  HAND,
  initCards,
  solveCards,
} from './rules';
import { createCardScene } from './scene';

const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

/** Goal line: the pair being built ("8 + 5 = ?"), its result once revealed; − puts the bigger first. */
function goal(s: CardState): string {
  const d = s.duel;
  if (!d) return '';
  const vals = s.picked.map((id) => d.hand[id] as number);
  if (s.op === '-' && vals.length === 2) vals.sort((a, b) => b - a);
  const sign = s.op === '+' ? '+' : '−';
  const res = s.phase === 'reveal' && s.mine ? String(s.mine.result) : '?';
  if (vals.length === 0) return `🎯 ${d.target}`;
  // the target stays in view next to the pair being built
  return `🃏 ${vals[0]} ${sign} ${vals[1] ?? '?'} = ${res} 🎯 ${d.target}`;
}

/** What the friend says: the challenge, then the comparison as words ("1 차이 vs 2 차이"). */
function say(s: CardState): HudView['say'] {
  const d = s.duel;
  if (!d) return undefined;
  const name = ko.cards.bots[s.bot];
  const at = s.core.index;
  if (s.phase === 'reveal' && s.mine && s.phaseLeft < 120) {
    const v = {
      t: d.target,
      r: s.mine.result,
      b: d.bot.result,
      dr: distance(d.target, s.mine.result),
      db: distance(d.target, d.bot.result),
      bot: name,
    };
    const text =
      s.mine.result === d.target
        ? fill(ko.cards.perfect, v)
        : s.outcome === 1
          ? fill(ko.cards.win, v)
          : s.outcome === -1
            ? fill(ko.cards.lose, v)
            : fill(ko.cards.tie, v);
    return { key: `reveal-${at}`, text };
  }
  if (at === 0) return { key: 'intro', text: fill(ko.cards.intro, { bot: name, t: d.target }) };
  return { key: `duel-${at}`, text: fill(ko.cards.next, { t: d.target }) };
}

export const cardModule: StageModule<CardState, CardAction> = {
  id: 'cardbattle',
  rules: { ...cardRules, init: (seed, level, opts) => initCards(seed, level, opts) },
  bgm: 'cards',
  createScene: createCardScene,
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
      success: s.phase === 'reveal' && s.outcome === 1,
      hintMode: 'standard',
      ...(sayNow ? { say: sayNow } : {}),
      ...(s.phase === 'deal' && s.core.index === 0
        ? { cut: { key: 'versus', title: fill(ko.cards.versus, { bot: ko.cards.bots[s.bot] }) } }
        : {}),
      ...(s.phase === 'play' && s.picked.length === 2 ? { primary: { label: ko.cards.play, left: 0 } } : {}),
      ...(s.phase === 'play' || s.phase === 'deal'
        ? {
            toggles: [
              { id: '+', label: '+', on: s.op === '+' },
              { id: '-', label: '−', on: s.op === '-' },
            ],
          }
        : {}),
    };
  },
  // hint step 3+: a card of the exact pair glows (then the right sign)
  glowTarget: (s) => {
    const d = s.duel;
    if (!d) return null;
    const best = bestPlay(d.hand, d.target);
    const next = best.cards.find((id) => !s.picked.includes(id));
    return next ?? null;
  },
  solution: (s) => (s.phase === 'play' || s.phase === 'deal' ? solveCards(s) : []),
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
  primaryAction: { t: 'play' },
  toggleAction: (id) => ({ t: 'op', op: id === '-' ? '-' : '+' }),
};
