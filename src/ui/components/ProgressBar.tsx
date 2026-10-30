export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-4 w-24 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-ink)_12%,white)] sm:w-44">
        <div
          className="h-full rounded-full bg-[var(--color-sun)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-lg font-bold tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}
