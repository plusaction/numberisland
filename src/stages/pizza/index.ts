import { fmt as fill, ko } from '../../i18n/ko';
import type { HudView, StageModule } from '../_shared/module';
import {
  initPizza,
  KEY,
  KEYS,
  type PizzaAction,
  type PizzaState,
  pizzaRules,
  solvePizza,
  VIP_ORDER,
} from './rules';
import { createPizzaScene } from './scene';

/** Goal line: bake `🍕 a + b = ?`, pack `📦 a − b = ?` (the answer shows once it is served). */
function goal(s: PizzaState): string {
  const o = s.order;
  if (!o) return '';
  const ans = s.phase === 'serve' ? String(o.answer) : '?';
  return o.role === 'bake' ? `🍕 ${o.a} + ${o.b} = ${ans}` : `📦 ${o.a} − ${o.b} = ${ans}`;
}

/** What 피자랑 says now (the bubble re-speaks only when the key changes). */
function say(s: PizzaState): HudView['say'] {
  const o = s.order;
  if (!o) return undefined;
  const at = s.core.index;
  if (s.phase === 'serve') {
    if (at + 1 >= s.core.puzzles) return { key: `shop-${at}`, text: ko.pizza.shop };
    return o.role === 'bake'
      ? { key: `baked-${at}`, text: fill(ko.pizza.baked, { n: o.answer }) }
      : { key: `packed-${at}`, text: fill(ko.pizza.packed, { n: o.answer }) };
  }
  if (s.phase === 'jam')
    return { key: `jam-${s.core.wrong}`, text: o.role === 'bake' ? ko.pizza.jamBake : ko.pizza.jamPack };
  const ask = fill(o.role === 'bake' ? ko.pizza.bake : ko.pizza.pack, { a: o.a, b: o.b });
  if (at === 0) return { key: `ask-${at}-${o.a}-${o.b}`, text: `${ko.pizza.intro} ${ask}` };
  if (o.vip) return { key: `ask-${at}-${o.a}-${o.b}`, text: `${ko.pizza.vipLine} ${ask}` };
  return { key: `ask-${at}-${o.a}-${o.b}`, text: ask };
}

export const pizzaModule: StageModule<PizzaState, PizzaAction> = {
  id: 'pizza',
  rules: { ...pizzaRules, init: (seed, level, opts) => initPizza(seed, level, opts) },
  bgm: 'pizza',
  createScene: createPizzaScene,
  keyboard: {
    targets: () => Array.from({ length: KEYS }, (_, i) => KEY(i)),
    confirm: (_s, id) => ({ action: { t: 'pick', id } }),
  },
  hud: (s) => {
    const o = s.order;
    const sayNow = say(s);
    return {
      core: s.core,
      question: s.core.asked?.question ?? null,
      goal: goal(s),
      wrong: s.phase === 'jam' ? s.lastWrong : null,
      success: s.phase === 'serve',
      hintMode: 'standard',
      ...(sayNow ? { say: sayNow } : {}),
      ...(s.phase === 'enter' && o
        ? {
            cut: {
              key: `order-${s.core.index}`,
              title:
                s.core.index === VIP_ORDER
                  ? ko.pizza.vip
                  : fill(ko.pizza.order, { i: s.core.index + 1, n: s.core.puzzles }),
            },
          }
        : {}),
    };
  },
  // hint step 3+: the right pizza key sparkles
  glowTarget: (s) => (s.order ? KEY(s.order.options.indexOf(s.order.answer)) : null),
  // also during the walk-in, so the first-order tutorial hand can show the way (input still waits)
  solution: (s) => (s.phase === 'play' || s.phase === 'enter' ? solvePizza(s) : []),
  hudKey: (s) => `${s.tried.length}`,
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
};
