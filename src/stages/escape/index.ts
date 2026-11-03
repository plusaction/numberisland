import { ko } from '../../i18n/ko';
import type { StageModule } from '../_shared/module';
import {
  DIAL_DOWN,
  DIAL_UP,
  type EscapeAction,
  type EscapeState,
  escapeRules,
  HANDLE,
  initEscape,
  shownNumbers,
  solveEscape,
  WHEELS,
} from './rules';
import { createEscapeScene } from './scene';

/** Goal line: the lock's number sentence; clues found so far fill the "?"s, □ is the code. */
function goal(s: EscapeState): string {
  const room = s.room;
  if (!room) return '';
  const shown = shownNumbers(room, s.found);
  const parts: string[] = [];
  room.nums.forEach((n, i) => {
    if (i > 0) parts.push(i === room.nums.length - 1 ? '=' : room.ops[i - 1] === '-' ? '−' : '+');
    // the code shows in its box once the door opens (the true sentence, complete)
    parts.push(
      i === room.hole ? (s.phase === 'open' ? String(n) : '□') : shown[i] !== null ? String(n) : '?',
    );
  });
  return `🔒 ${parts.join(' ')}`;
}

export const escapeModule: StageModule<EscapeState, EscapeAction> = {
  id: 'escape',
  rules: { ...escapeRules, init: (seed, level, opts) => initEscape(seed, level, opts) },
  bgm: 'escape',
  createScene: createEscapeScene,
  keyboard: {
    targets: (s) => [
      ...(s.room?.things.map((t) => t.id) ?? []),
      ...Array.from({ length: WHEELS }, (_, w) => [DIAL_UP(w), DIAL_DOWN(w)]).flat(),
      HANDLE,
    ],
    confirm: (_s, id) => ({
      action:
        id === HANDLE
          ? { t: 'open' }
          : id >= 100
            ? { t: 'dial', wheel: Math.floor((id - 100) / 2), dir: (id - 100) % 2 === 0 ? 1 : -1 }
            : { t: 'tap', id },
    }),
  },
  hud: (s) => ({
    core: s.core,
    question: s.core.asked?.question ?? null,
    goal: goal(s),
    wrong: s.phase === 'jam' ? s.lastWrong : null,
    success: s.phase === 'open',
    hintMode: 'standard',
    ...(s.phase === 'play' && s.room ? { primary: { label: ko.stageHud.open, left: 0 } } : {}),
  }),
  // hint step 3+: the next clue thing not found yet sparkles
  glowTarget: (s) => s.room?.things.find((t) => t.clue !== null && !s.found.includes(t.id))?.id ?? null,
  solution: (s) => (s.phase === 'play' ? solveEscape(s) : []),
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
  primaryAction: { t: 'open' },
};
