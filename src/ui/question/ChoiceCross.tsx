/**
 * 4-choice cross layout (↑ ← → ↓) matching arrow keys / WASD (SPEC §8.1); 2 choices use ← →.
 * A small arrow in each slot tells keyboard players which key picks it.
 */
import { useEffect } from 'react';
import type { Choice } from '../../domain/edu/types';

const SLOT_KEYS: Record<string, number> = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowLeft: 1,
  KeyA: 1,
  ArrowRight: 2,
  KeyD: 2,
  ArrowDown: 3,
  KeyS: 3,
};
// small arrows show which key picks the slot (no pad-like symbols, no clash with place-value marks)
const ARROWS = ['↑', '←', '→', '↓'];
const POS = [
  'col-start-2 row-start-1',
  'col-start-1 row-start-2',
  'col-start-3 row-start-2',
  'col-start-2 row-start-3',
];

export function ChoiceCross({
  choices,
  onPick,
  disabled = false,
  shake,
  keys = true,
  dim,
}: {
  choices: readonly Choice[];
  onPick(value: number): void;
  disabled?: boolean;
  shake?: number | null;
  /** false: the host handles arrow keys itself (stage runtime: keyboard + gamepad in the fixed step). */
  keys?: boolean;
  /** Answers already tried: dimmed and not pressable. */
  dim?: readonly number[];
}) {
  const two = choices.length === 2;
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      let slot = SLOT_KEYS[e.code];
      if (slot === undefined) return;
      if (two) slot = slot === 1 ? 0 : slot === 2 ? 1 : -1;
      const c = choices[slot];
      if (c) {
        e.preventDefault();
        onPick(c.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choices, onPick, disabled, two, keys]);

  return (
    <div
      className={two ? 'grid grid-cols-2 gap-6' : 'grid grid-cols-3 grid-rows-3 gap-3'}
      data-testid="choices"
    >
      {choices.map((c, i) => (
        <button
          key={`${c.value}-${c.display ?? ''}`}
          type="button"
          disabled={disabled || dim?.includes(c.value) === true}
          data-value={c.value}
          onClick={() => onPick(c.value)}
          className={`toy-btn choice-btn ${two ? '' : POS[i]} ${shake === c.value ? 'animate-wiggle' : ''} ${dim?.includes(c.value) ? 'choice-dim' : ''}`}
        >
          <span aria-hidden="true" className="choice-shape">
            {ARROWS[two ? (i === 0 ? 1 : 2) : i]}
          </span>
          <span className="choice-num">{c.display ? c.display.replaceAll('-', '−') : c.value}</span>
        </button>
      ))}
    </div>
  );
}
