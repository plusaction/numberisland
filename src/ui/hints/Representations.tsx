// biome-ignore-all lint/suspicious/noArrayIndexKey: static SVG lists never reorder
/**
 * SVG renderings of the five representations (SPEC §9.2): dots · tenframe · blocks · numberline · column.
 * The hidden quantity (□) is always drawn as a mystery box, never as its value.
 */
import type { ReactElement } from 'react';
import type { ColumnStep, Op, Representation } from '../../domain/edu/types';

const INK = '#3b3355';
const PLACE = ['#22a654', '#2f6fe8', '#8a46dc', '#d99a00'];
const OPERAND = ['#ff8fab', '#6fd0e3', '#ffd166'];

function Mystery({ x, y, s = 40 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={8}
        fill="#fff8ec"
        stroke={INK}
        strokeWidth={4}
        strokeDasharray="6 4"
      />
      <text x={x + s / 2} y={y + s * 0.72} textAnchor="middle" fontSize={s * 0.7} fontWeight={800} fill={INK}>
        ?
      </text>
    </g>
  );
}

export function Dots({ quantities, hidden }: { quantities: number[]; hidden?: number }) {
  let x = 10;
  const items: ReactElement[] = [];
  quantities.forEach((q, qi) => {
    if (qi === hidden) {
      items.push(<Mystery key={`m${qi}`} x={x} y={20} />);
      x += 60;
      return;
    }
    for (let i = 0; i < q; i++) {
      const col = Math.floor(i / 5);
      const row = i % 5;
      items.push(
        <circle
          key={`${qi}-${i}`}
          cx={x + col * 22 + 10}
          cy={14 + row * 20}
          r={8}
          fill={OPERAND[qi % 3]}
          stroke={INK}
          strokeWidth={2}
        />,
      );
    }
    x += Math.ceil(Math.max(q, 1) / 5) * 22 + 26;
  });
  return (
    <svg viewBox={`0 0 ${Math.max(120, x)} 115`} className="hint-svg" role="img" aria-label="dots">
      {items}
    </svg>
  );
}

export function TenFrame({ quantities, hidden }: { quantities: number[]; hidden?: number }) {
  // fill frames left to right, each operand its own colour (10 만들기 shows where the frame completes).
  // The unknown is NOT drawn as cells (their count would reveal it): one "?" box follows the frames.
  const cells: string[] = [];
  quantities.forEach((q, qi) => {
    if (qi === hidden) return;
    for (let i = 0; i < q; i++) cells.push(OPERAND[qi % 3] as string);
  });
  const frames = Math.max(1, Math.ceil(cells.length / 10));
  const width = frames * 230 + (hidden !== undefined ? 70 : 0);
  return (
    <svg viewBox={`0 0 ${width} 100`} className="hint-svg" role="img" aria-label="ten frame">
      {Array.from({ length: frames * 10 }, (_, i) => {
        const f = Math.floor(i / 10);
        const k = i % 10;
        const x = f * 230 + 10 + (k % 5) * 42;
        const y = 10 + Math.floor(k / 5) * 42;
        const c = cells[i];
        return (
          <g key={i}>
            <rect x={x} y={y} width={40} height={40} fill="white" stroke={INK} strokeWidth={3} />
            {c && <circle cx={x + 20} cy={y + 20} r={14} fill={c} stroke={INK} strokeWidth={2} />}
          </g>
        );
      })}
      {hidden !== undefined && <Mystery x={frames * 230 + 10} y={30} />}
    </svg>
  );
}

/** Place-value blocks: 1000 = gold cube, 100 = purple flat, 10 = blue rod, 1 = green cube (+ shape marks). */
export function Blocks({ quantities, hidden }: { quantities: number[]; hidden?: number }) {
  let x = 10;
  const out: ReactElement[] = [];
  quantities.forEach((q, qi) => {
    if (qi === hidden) {
      out.push(<Mystery key={`m${qi}`} x={x} y={40} />);
      x += 70;
      return;
    }
    const th = Math.floor(q / 1000);
    const h = Math.floor((q % 1000) / 100);
    const t = Math.floor((q % 100) / 10);
    const o = q % 10;
    for (let i = 0; i < th; i++, x += 34)
      out.push(
        <rect
          key={`${qi}k${i}`}
          x={x}
          y={20}
          width={30}
          height={30}
          rx={4}
          fill={PLACE[3]}
          stroke={INK}
          strokeWidth={2}
        />,
      );
    for (let i = 0; i < h; i++, x += 30)
      out.push(
        <rect
          key={`${qi}h${i}`}
          x={x}
          y={10}
          width={26}
          height={70}
          rx={3}
          fill={PLACE[2]}
          stroke={INK}
          strokeWidth={2}
        />,
      );
    for (let i = 0; i < t; i++, x += 14)
      out.push(
        <rect
          key={`${qi}t${i}`}
          x={x}
          y={10}
          width={10}
          height={70}
          rx={3}
          fill={PLACE[1]}
          stroke={INK}
          strokeWidth={2}
        />,
      );
    for (let i = 0; i < o; i++)
      out.push(
        <rect
          key={`${qi}o${i}`}
          x={x + (i % 3) * 12}
          y={56 - Math.floor(i / 3) * 12}
          width={10}
          height={10}
          rx={2}
          fill={PLACE[0]}
          stroke={INK}
          strokeWidth={1.5}
        />,
      );
    x += o ? 44 : 6;
    x += 24;
  });
  return (
    <svg viewBox={`0 0 ${Math.max(120, x)} 90`} className="hint-svg" role="img" aria-label="blocks">
      {out}
    </svg>
  );
}

/** Number line with hops: start → +b (or −b); the landing spot is the answer (shown as ? when hidden). */
export function NumberLine({
  from,
  hop,
  op,
  hideEnd,
  hideHop,
}: {
  from: number;
  hop: number;
  op: Op;
  hideEnd?: boolean;
  /** For "□ jump" questions the jump is the unknown: draw "?" instead of its size. */
  hideHop?: boolean;
}) {
  const end = op === '+' ? from + hop : from - hop;
  const lo = Math.min(from, end);
  const hi = Math.max(from, end);
  const span = Math.max(1, hi - lo);
  const X = (v: number) => 30 + ((v - lo) / span) * 440;
  const step = span <= 20 ? 1 : span <= 100 ? 10 : span <= 1000 ? 100 : 1000;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return (
    <svg viewBox="0 0 500 110" className="hint-svg" role="img" aria-label="number line">
      <line x1={20} y1={80} x2={480} y2={80} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      {ticks.map((v) => (
        <line key={v} x1={X(v)} y1={72} x2={X(v)} y2={88} stroke={INK} strokeWidth={2} />
      ))}
      <path
        d={`M ${X(from)} 76 Q ${(X(from) + X(end)) / 2} 0 ${X(end)} 76`}
        fill="none"
        stroke="#ff8fab"
        strokeWidth={5}
        markerEnd="url(#arrow)"
      />
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#ff8fab" />
        </marker>
      </defs>
      <text x={X(from)} y={106} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK}>
        {from}
      </text>
      <text x={(X(from) + X(end)) / 2} y={30} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK}>
        {op === '+' ? '+' : '−'}
        {hideHop ? '?' : hop}
      </text>
      <text x={X(end)} y={106} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK}>
        {hideEnd ? '?' : end}
      </text>
    </svg>
  );
}

/** Written column method with carry (+1 dot above) / borrow (crossed digit + 10) highlights. */
export function Column({
  a,
  b,
  op,
  columns,
  revealUpTo = 99,
}: {
  a: number;
  b: number;
  op: Op;
  columns: ColumnStep[];
  revealUpTo?: number;
}) {
  const n = columns.length;
  const W = 52;
  const x = (place: number) => 20 + (n - 1 - place) * W + W;
  return (
    <svg viewBox={`0 0 ${(n + 1) * W + 40} 200`} className="hint-svg" role="img" aria-label="column">
      {columns.map((c) => (
        <g key={c.place}>
          <rect
            x={x(c.place) - 22}
            y={6}
            width={44}
            height={188}
            rx={8}
            fill={`${PLACE[Math.min(3, c.place)]}22`}
          />
          {c.carryIn !== 0 && (
            <text x={x(c.place)} y={30} textAnchor="middle" fontSize={20} fontWeight={800} fill="#e8505b">
              {c.carryIn > 0 ? '·1' : '−1'}
            </text>
          )}
          {c.carryOut < 0 && (
            <text
              x={x(c.place) + 14}
              y={30}
              textAnchor="middle"
              fontSize={16}
              fontWeight={800}
              fill="#e8505b"
            >
              +10
            </text>
          )}
          <text x={x(c.place)} y={70} textAnchor="middle" fontSize={34} fontWeight={800} fill={INK}>
            {c.place < String(a).length ? c.top : ''}
          </text>
          <text x={x(c.place)} y={115} textAnchor="middle" fontSize={34} fontWeight={800} fill={INK}>
            {c.place < String(b).length ? c.bottom : ''}
          </text>
          {c.place <= revealUpTo ? (
            <text x={x(c.place)} y={180} textAnchor="middle" fontSize={34} fontWeight={800} fill="#22a654">
              {c.digit}
            </text>
          ) : (
            // the answer is never written for the child (SPEC §9.5: no auto-filled answers)
            <rect
              x={x(c.place) - 16}
              y={148}
              width={32}
              height={38}
              rx={6}
              fill="white"
              stroke={INK}
              strokeWidth={3}
              strokeDasharray="5 4"
            />
          )}
        </g>
      ))}
      <text x={20} y={115} fontSize={34} fontWeight={800} fill={INK}>
        {op === '+' ? '+' : '−'}
      </text>
      <line x1={14} y1={130} x2={(n + 1) * W + 30} y2={130} stroke={INK} strokeWidth={4} />
    </svg>
  );
}

export function RepresentationView({
  kind,
  quantities,
  hidden,
  ops,
}: {
  kind: Representation;
  quantities: number[];
  hidden?: number;
  ops: Op[];
}) {
  switch (kind) {
    case 'dots':
      return <Dots quantities={quantities} {...(hidden !== undefined ? { hidden } : {})} />;
    case 'tenframe':
      return <TenFrame quantities={quantities} {...(hidden !== undefined ? { hidden } : {})} />;
    case 'blocks':
      return <Blocks quantities={quantities} {...(hidden !== undefined ? { hidden } : {})} />;
    case 'numberline': {
      const [from = 0, hop = 0] = quantities;
      if (hidden === 0) return <Blocks quantities={quantities} hidden={0} />;
      return hidden === 1 ? (
        <NumberLine from={from} hop={hop} op={ops[0] ?? '+'} hideHop />
      ) : (
        <NumberLine from={from} hop={hop} op={ops[0] ?? '+'} hideEnd />
      );
    }
    case 'column': {
      const [a = 0, b = 0] = quantities;
      return <Blocks quantities={[a, b]} {...(hidden !== undefined ? { hidden } : {})} />;
    }
  }
}
