import { fmt as fill, ko } from '../../i18n/ko';
import type { HudView, StageModule } from '../_shared/module';
import {
  allFound,
  type EscapeAction,
  type EscapeState,
  escapeRules,
  initEscape,
  KEY,
  KEYS,
  shownNumbers,
  solveEscape,
} from './rules';
import { createEscapeScene } from './scene';

/** Room name without its emoji, for the friend's sentence ("주방이야"). */
const plainName = (title: string) => title.replace(/^\S+\s/, '');

/** Goal line: the lock's number sentence; found clues fill the "?"s, □ is the code (shown once it opens). */
function goal(s: EscapeState): string {
  const room = s.room;
  if (!room) return '';
  const shown = shownNumbers(room, s.found);
  const parts: string[] = [];
  room.nums.forEach((n, i) => {
    if (i > 0) parts.push(i === room.nums.length - 1 ? '=' : room.ops[i - 1] === '-' ? '−' : '+');
    parts.push(
      i === room.hole ? (s.phase === 'open' ? String(n) : '□') : shown[i] !== null ? String(n) : '?',
    );
  });
  return `🔒 ${parts.join(' ')}`;
}

/** What the friend says now (the bubble re-speaks only when the key changes). */
function say(s: EscapeState): HudView['say'] {
  const room = s.room;
  if (!room) return undefined;
  const at = s.core.index;
  if (s.phase === 'open') return { key: `open-${at}`, text: room.boss ? ko.escape.thanks : ko.escape.opened };
  if (s.phase === 'jam') return { key: `jam-${s.core.wrong}`, text: ko.escape.jam };
  if (allFound(room, s.found)) return { key: `all-${at}`, text: ko.escape.allFound };
  if (room.boss) return { key: `enter-${at}`, text: ko.escape.boss };
  if (at === 0) return { key: 'intro', text: ko.escape.intro };
  return {
    key: `enter-${at}`,
    text: fill(ko.escape.enter, { room: plainName(ko.escape.rooms[room.theme]) }),
  };
}

const clueIds = (s: EscapeState) =>
  s.found.filter((id) => s.room?.things.find((t) => t.id === id)?.clue !== null);

export const escapeModule: StageModule<EscapeState, EscapeAction> = {
  id: 'escape',
  rules: { ...escapeRules, init: (seed, level, opts) => initEscape(seed, level, opts) },
  bgm: 'escape',
  createScene: createEscapeScene,
  keyboard: {
    targets: (s) =>
      s.room && allFound(s.room, s.found)
        ? Array.from({ length: KEYS }, (_, i) => KEY(i))
        : (s.room?.things.filter((t) => !s.found.includes(t.id)).map((t) => t.id) ?? []),
    confirm: (_s, id) => ({ action: id >= KEY(0) ? { t: 'pick', id } : { t: 'tap', id } }),
  },
  hud: (s) => {
    const room = s.room;
    const need = room ? room.things.filter((t) => t.clue !== null).length : 0;
    const found = clueIds(s).length;
    const sayNow = say(s);
    return {
      core: s.core,
      question: s.core.asked?.question ?? null,
      goal: goal(s),
      wrong: s.phase === 'jam' ? s.lastWrong : null,
      success: s.phase === 'open',
      hintMode: 'standard',
      ...(sayNow ? { say: sayNow } : {}),
      ...(s.phase === 'enter' && room
        ? { cut: { key: `room-${s.core.index}`, title: ko.escape.rooms[room.theme] } }
        : {}),
      ...(room && s.phase !== 'open' ? { steps: { at: found < need ? 0 : 2, found, need } } : {}),
    };
  },
  // hint step 3+: the next clue thing sparkles; once all are found, the right key does
  glowTarget: (s) => {
    const room = s.room;
    if (!room) return null;
    const next = room.things.find((t) => t.clue !== null && !s.found.includes(t.id));
    return next ? next.id : KEY(room.options.indexOf(room.code));
  },
  // also during the entry cut, so the first-room tutorial hand can show the way (input still waits)
  solution: (s) => (s.phase === 'play' || s.phase === 'enter' ? solveEscape(s) : []),
  hintAction: { t: 'hint' },
  retryAction: { t: 'retry' },
  // each found number flies from the thing into its "?" in the sentence
  picks: clueIds,
  pickValue: (s, id) => s.room?.things.find((t) => t.id === id)?.clue ?? undefined,
};
