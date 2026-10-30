/**
 * The question as toy number tiles (D22): every number is a white plastic tile with place-value colours
 * (ones green, tens blue — the same as the 3D badges), operators are small round tokens, and an empty "?"/"□"
 * is a dashed slot. When a picked number fills a slot the tile drops in (motion answers the child's action).
 */
import { useRef } from 'react';

type Token =
  | { kind: 'icon'; text: string }
  | { kind: 'num'; text: string }
  | { kind: 'slot'; text: string }
  | { kind: 'op'; text: string };

export function tokenize(goal: string): Token[] {
  return goal
    .split(/\s+/)
    .filter(Boolean)
    .map((t): Token => {
      if (/^-?\d+$/.test(t)) return { kind: 'num', text: t };
      if (t === '?' || t === '□') return { kind: 'slot', text: t };
      if (/^[+\-−=×÷<>]$/.test(t)) return { kind: 'op', text: t };
      return { kind: 'icon', text: t };
    });
}

function Digits({ text }: { text: string }) {
  const neg = text.startsWith('-');
  const digits = neg ? text.slice(1) : text;
  return (
    <>
      {neg && <span className="text-[var(--color-berry-deep)]">−</span>}
      {digits.split('').map((d, i) => {
        const place = digits.length - 1 - i;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: digits of one number, fixed order
          <span key={i} className={place === 0 ? 'd-ones' : place === 1 ? 'd-tens' : ''}>
            {d}
          </span>
        );
      })}
    </>
  );
}

export function GoalTiles({ goal }: { goal: string }) {
  const tokens = tokenize(goal);
  // remember which positions were slots last render: a number appearing there "drops in"
  const prevSlots = useRef<Set<number>>(new Set());
  const was = prevSlots.current;
  const nowSlots = new Set<number>();
  tokens.forEach((t, i) => {
    if (t.kind === 'slot') nowSlots.add(i);
  });
  prevSlots.current = nowSlots;
  return (
    <span className="goal-tiles" role="img" aria-label={goal.replace(/[^\d?□+\-−=×÷<>\s]/gu, '').trim()}>
      {tokens.map((t, i) => {
        const key = `${i}-${t.kind}`;
        if (t.kind === 'icon')
          return (
            <span key={key} className="gt-icon" aria-hidden="true">
              {t.text}
            </span>
          );
        if (t.kind === 'slot')
          return (
            <span key={key} className="gt-slot" aria-hidden="true">
              {t.text === '□' ? '' : '?'}
            </span>
          );
        if (t.kind === 'op')
          return (
            <span key={key} className={`gt-op ${t.text === '=' ? 'gt-eq' : ''}`} aria-hidden="true">
              {t.text === '-' ? '−' : t.text}
            </span>
          );
        return (
          <span
            key={`${key}-${t.text}`}
            className={`gt-num ${was.has(i) ? 'gt-new' : ''}`}
            aria-hidden="true"
          >
            <Digits text={t.text} />
          </span>
        );
      })}
    </span>
  );
}
