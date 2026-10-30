/** A number in place-value colours (D19: digits only, no marks); the asked place is boxed and pulsing. */
const COLORS = ['#22a654', '#2f6fe8', '#8a46dc', '#d99a00'];

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
            className={`inline-flex items-center rounded-2xl px-2 ${asked ? 'place-asked' : ''}`}
            style={{ color: COLORS[Math.min(3, p)] }}
          >
            {d}
          </span>
        );
      })}
    </span>
  );
}
