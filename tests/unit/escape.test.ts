import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/domain/curriculum/curriculum';
import { generateQuestion } from '../../src/domain/edu/generate';
import { createRng } from '../../src/domain/rng/rng';
import {
  type EscapeAction,
  type EscapeState,
  escapeRules,
  HANDLE,
  JAM_TICKS,
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

  it('a wrong code only rattles the lock: nothing lost, the wheels stay, then it can be opened', () => {
    let s = escapeRules.init('jam-1', 'A3');
    let tick = 0;
    const room = s.room as NonNullable<EscapeState['room']>;
    const coins = s.core.coins;
    const wrongDial = room.code === 0 ? 1 : 0;
    s = step(s, ++tick, [{ t: 'dial', wheel: 1, dir: wrongDial === 1 ? 1 : 1 }]);
    s = { ...s, dial: [0, room.code % 10 === 9 ? 8 : (room.code % 10) + 1] };
    const dial = s.dial.slice();
    s = step(s, ++tick, [{ t: 'open' }]);
    expect(s.phase).toBe('jam');
    expect(s.core.coins).toBeGreaterThanOrEqual(coins);
    for (let i = 0; i < JAM_TICKS; i++) s = step(s, ++tick);
    expect(s.phase).toBe('play');
    expect(s.dial).toEqual(dial);
    s = step(s, ++tick, solveEscape(s));
    expect(s.phase).toBe('open');
    expect(HANDLE).toBeGreaterThan(100);
  });
});
