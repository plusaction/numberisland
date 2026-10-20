import { fmt, ko } from '../../i18n/ko';

/** Stars with shape (filled vs outline) — never colour alone (P9). */
export function Stars({ n, max = 3, size = 'text-3xl' }: { n: number; max?: number; size?: string }) {
  return (
    <span role="img" aria-label={fmt(ko.a11y.stars, { n })} className={`inline-flex gap-1 ${size}`}>
      {Array.from({ length: max }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative list
        <span key={i} aria-hidden="true" className={i < n ? 'star-on' : 'star-off'}>
          {i < n ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
