/**
 * Tiny explicit state machines (pure data + two functions).
 *
 * The app used to keep several machines implicit — a `screen` string anyone could set to anything, a
 * handful of booleans for "tutorial / playing / hint", and stage phases whose legal moves lived only inside
 * the step functions. A machine here is just a table: for every state, which events lead where. The same
 * table drives the code (`next`), the tests (every transition seen in play must be in the table) and the
 * generated docs (`docs/STATE_MACHINES.md`), so people and coding agents read one source of truth.
 */
export interface Machine<S extends string, E extends string> {
  readonly name: string;
  readonly initial: S;
  /** state → event → target state. An event missing from a state is simply not allowed there. */
  readonly states: { readonly [K in S]: { readonly [K2 in E]?: S } };
}

export function defineMachine<S extends string, E extends string>(m: Machine<S, E>): Machine<S, E> {
  return m;
}

/** The state after `event`, or the same state when the event is not allowed there. */
export function next<S extends string, E extends string>(m: Machine<S, E>, state: S, event: E): S {
  return m.states[state][event] ?? state;
}

export function can<S extends string, E extends string>(m: Machine<S, E>, state: S, event: E): boolean {
  return m.states[state][event] !== undefined;
}

/** Is `from → to` reachable by one event? (For machines driven by "go to X" rather than named events.) */
export function allows<S extends string, E extends string>(m: Machine<S, E>, from: S, to: S): boolean {
  return Object.values(m.states[from]).includes(to);
}

/** Mermaid `stateDiagram-v2` text (docs). */
export function toMermaid<S extends string, E extends string>(m: Machine<S, E>): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${m.initial}`];
  for (const [from, events] of Object.entries(m.states) as [S, Partial<Record<E, S>>][])
    for (const [event, to] of Object.entries(events) as [E, S][]) lines.push(`  ${from} --> ${to}: ${event}`);
  return lines.join('\n');
}

/**
 * A stage's phases as a table: can the child act in this phase, does it run on a timer, and which phases
 * may follow. Stage rules stay plain step functions; this table documents them and the tests hold them to it.
 */
export interface PhaseSpec<P extends string> {
  /** The child's answers are accepted here (harnesses and the tutorial feed the solution only then). */
  input: boolean;
  /** A show that ends by itself after some ticks (`phaseLeft`). */
  timed: boolean;
  to: readonly P[];
  /** One line for the docs. */
  note: string;
}
export type PhaseTable<P extends string> = { readonly [K in P]: PhaseSpec<P> };

export function phasesToMermaid<P extends string>(initial: P, table: PhaseTable<P>): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${initial}`];
  for (const [from, spec] of Object.entries(table) as [P, PhaseSpec<P>][]) {
    for (const to of spec.to) lines.push(`  ${from} --> ${to}`);
    if (from === 'done') lines.push('  done --> [*]');
  }
  return lines.join('\n');
}
