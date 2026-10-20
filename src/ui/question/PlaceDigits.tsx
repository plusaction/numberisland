/** A number with place-value colours + marks; the asked place is boxed and pulsing ("이 자리 숫자는?"). */
const COLORS = ['#22a654', '#2f6fe8', '#8a46dc', '#d99a00'];
const MARKS = ['●', '▬', '★', '◆'];

export function PlaceDigits({ n, place }: { n: number; place?: number }) {
  const digits = String(n).split('');
  return (
    <span className="inline-flex gap-1">
      {digits.map((d, i) => {
        const p = digits.length - 1 - i;
        const asked = p === place;
        return (
          <span
            key={`${p}`}
            className={`inline-flex flex-col items-center rounded-2xl px-2 ${asked ? 'place-asked' : ''}`}
            style={{ color: COLORS[Math.min(3, p)] }}
          >
            <span>{d}</span>
            <span aria-hidden="true" className="text-2xl leading-none">
              {MARKS[Math.min(3, p)]}
            </span>
          </span>
        );
      })}
    </span>
  );
}
