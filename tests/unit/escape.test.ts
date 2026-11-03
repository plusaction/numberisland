import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/domain/curriculum/curriculum';
import { generateQuestion } from '../../src/domain/edu/generate';
import { createRng } from '../../src/domain/rng/rng';
import {
  allFound,
  ENTER_TICKS,
  type EscapeAction,
  type EscapeState,
  escapeRules,
  JAM_TICKS,
  KEY,
  KEYS,
  roomFromQuestion,
  sentence,
  shownNumbers,
  solveEscape,
} from '../../src/stages/escape/rules';

const step = (s: EscapeState, tick: number, actions: EscapeAction[] = []) =>
  escapeRules.step(s, { tick, actions });

function play(seed: string, level: string) {
  let s = escapeRules.init(seed, level as never);
  let tick = 0;
  const rooms: EscapeState['room'][] = [];
  while (s.phase !== 'done' && tick < 20_000) {
    if (s.phase === 'play' && s.room && rooms[rooms.length - 1] !== s.room) rooms.push(s.room);
    s = step(s, ++tick, s.phase === 'play' ? solveEscape(s) : []);
  }
  return { s, rooms };
}

describe('[G1:escape] 방탈출 규칙', () => {
  it('the clue sentence holds: nums with the code in the hole make a true equation', () => {
    const rng = createRng('sent');
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion({ level: 'A3', skill: 'MISSING_TERM', rng });
      const s = sentence(q);
      const lhs = s.nums
        .slice(0, -1)
        .reduce((acc, v, k) => (k === 0 ? v : s.ops[k - 1] === '+' ? acc + v : acc - v), 0);
      expect(lhs).toBe(s.nums[s.nums.length - 1]);
      expect(s.nums[s.hole]).toBe(s.code);
    }
  });

  it('every room hides exactly the needed clues; finding only them shows the whole sentence', () => {
    const rng = createRng('rooms');
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion({ level: 'A2', skill: 'ADD_CARRY', rng });
      const room = roomFromQuestion(q, 'kitchen', false, rng);
      const clues = room.things.filter((t) => t.clue !== null);
      expect(clues).toHaveLength(room.nums.length - 1);
      const shown = shownNumbers(
        room,
        clues.map((t) => t.id),
      );
      shown.forEach((v, k) => {
        expect(v).toBe(k === room.hole ? null : room.nums[k]);
      });
    }
  });

  it('solution play opens every room at every grade-1 level; the last room is the treasure room', () => {
    for (const level of CURRICULUM.filter((l) => ['L0_1', 'A1', 'A2', 'A3', 'A4', 'A6'].includes(l.id))) {
      for (let seed = 0; seed < 8; seed++) {
        const { s, rooms } = play(`esc-${level.id}-${seed}`, level.id);
        expect(s.phase).toBe('done');
        expect(s.core.wrong).toBe(0);
        expect(s.rescued).toBe(true);
        expect(rooms[rooms.length - 1]?.theme).toBe('treasure');
        expect(escapeRules.summary(s).highlights).toContain('rescued');
      }
    }
  });

  it('a room opens with a short entry cut (input waits), keys only work once every clue is found', () => {
    let s = escapeRules.init('enter-1', 'A3');
    let tick = 0;
    expect(s.phase).toBe('enter');
    const room = s.room as NonNullable<EscapeState['room']>;
    const right = KEY(room.options.indexOf(room.code));
    s = step(s, ++tick, [{ t: 'tap', id: 0 }]);
    expect(s.found).toEqual([]); // ignored during the cut
    for (let i = 0; i < ENTER_TICKS; i++) s = step(s, ++tick);
    expect(s.phase).toBe('play');
    s = step(s, ++tick, [{ t: 'pick', id: right }]);
    expect(s.phase).toBe('play'); // clues not found yet: the keys are not ready
    expect(room.options).toHaveLength(KEYS);
    expect(new Set(room.options).size).toBe(KEYS);
    expect(room.options).toContain(room.code);
  });

  it('a wrong key only rattles the lock and dims that key; nothing is lost, then it opens', () => {
    let s = escapeRules.init('jam-1', 'A3');
    let tick = 0;
    for (let i = 0; i < ENTER_TICKS; i++) s = step(s, ++tick);
    const room = s.room as NonNullable<EscapeState['room']>;
    const clues = room.things.filter((t) => t.clue !== null).map((t) => ({ t: 'tap' as const, id: t.id }));
    s = step(s, ++tick, clues);
    expect(allFound(room, s.found)).toBe(true);
    const coins = s.core.coins;
    const wrong = room.options.findIndex((v) => v !== room.code);
    s = step(s, ++tick, [{ t: 'pick', id: KEY(wrong) }]);
    expect(s.phase).toBe('jam');
    expect(s.tried).toEqual([room.options[wrong]]);
    expect(s.core.coins).toBeGreaterThanOrEqual(coins);
    for (let i = 0; i < JAM_TICKS; i++) s = step(s, ++tick);
    expect(s.phase).toBe('play');
    s = step(s, ++tick, solveEscape(s));
    expect(s.phase).toBe('open');
  });
});
