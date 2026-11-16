import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCREENS, SESSION, sessionFlags } from '../../src/application/machines';
import { createGameStore } from '../../src/application/stores/game';
import { allows, can, next, toMermaid } from '../../src/domain/fsm';
import { renderMachinesDoc } from '../../tools/machines-doc';

describe('[S1] 화면 흐름 머신', () => {
  it('every screen is reachable from boot and the hub is reachable from every screen but boot', () => {
    const reach = (from: keyof typeof SCREENS.states) => {
      const seen = new Set<string>([from]);
      const todo: (keyof typeof SCREENS.states)[] = [from];
      while (todo.length) {
        const s = todo.pop() as keyof typeof SCREENS.states;
        for (const t of Object.values(SCREENS.states[s]))
          if (!seen.has(t)) {
            seen.add(t);
            todo.push(t);
          }
      }
      return seen;
    };
    expect([...reach('boot')].sort()).toEqual(Object.keys(SCREENS.states).sort());
    for (const s of Object.keys(SCREENS.states) as (keyof typeof SCREENS.states)[])
      if (s !== 'boot') expect(reach(s).has('hub'), `${s} can reach the hub`).toBe(true);
  });

  it('the store refuses a move the machine does not list, and a late result after leaving', () => {
    const store = createGameStore();
    const warn = console.warn;
    const refused: string[] = [];
    console.warn = (m: string) => refused.push(m);
    try {
      store.getState().go('result'); // boot → result: no
      expect(store.getState().screen).toBe('boot');
      store.getState().go('hub');
      store.getState().go('stage'); // hub → stage without the intro: no
      expect(store.getState().screen).toBe('hub');
      store.getState().go('intro');
      store.getState().restart();
      expect(store.getState().screen).toBe('stage');
      const run = store.getState().runId;
      store.getState().go('hub');
      // a round-finish timer firing after "나가기" must not pull the child to the result screen
      store.getState().finishRound({} as never, { profile: null } as never);
      expect(store.getState().screen).toBe('hub');
      // "다시 하기" only from where a stage can start
      store.getState().restart();
      expect(store.getState().screen).toBe('hub');
      expect(store.getState().runId).toBe(run);
      expect(refused.length).toBe(2);
    } finally {
      console.warn = warn;
    }
  });
});

describe('[S1] 스테이지 진행 머신', () => {
  it('hints cannot open during the tutorial; a finished round takes no more events but a new start', () => {
    expect(next(SESSION, 'tutorial', 'hint.open')).toBe('tutorial');
    expect(next(SESSION, 'tutorial', 'tutorial.done')).toBe('playing');
    expect(next(SESSION, 'playing', 'hint.open')).toBe('hint');
    expect(next(SESSION, 'hint', 'hint.close')).toBe('playing');
    expect(next(SESSION, 'hint', 'round.done')).toBe('finished');
    expect(can(SESSION, 'finished', 'hint.open')).toBe(false);
    expect(next(SESSION, 'finished', 'start')).toBe('playing');
    expect(next(SESSION, 'finished', 'start.tutorial')).toBe('tutorial');
  });

  it('flags derive from the one state: input lock in the tutorial, pause only for real-time hints', () => {
    expect(sessionFlags('tutorial', false)).toMatchObject({
      inputLocked: true,
      simPaused: false,
      tutorial: true,
    });
    expect(sessionFlags('hint', false)).toMatchObject({
      inputLocked: false,
      simPaused: false,
      hintPanel: true,
    });
    expect(sessionFlags('hint', true).simPaused).toBe(true);
    expect(sessionFlags('playing', true)).toMatchObject({
      inputLocked: false,
      simPaused: false,
      hintPanel: false,
    });
    expect(sessionFlags('finished', true).inputLocked).toBe(true);
  });

  it('helpers: allows / mermaid', () => {
    expect(allows(SCREENS, 'intro', 'stage')).toBe(true);
    expect(allows(SCREENS, 'welcome', 'stage')).toBe(false);
    expect(toMermaid(SESSION)).toContain('playing --> hint: hint.open');
  });
});

describe('[S1] 상태 머신 문서', () => {
  it('docs/STATE_MACHINES.md is up to date with the tables in the code (run `pnpm machines:doc`)', () => {
    expect(readFileSync('docs/STATE_MACHINES.md', 'utf8')).toBe(renderMachinesDoc());
  });
});
