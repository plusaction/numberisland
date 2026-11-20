/** The game's currency: a little cut gem (shape + colour), the same pink/violet as the 3D gems. */
export function GemIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`gem-icon ${className}`}
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      aria-hidden="true"
    >
      <path d="M7 3h10l5 6-10 12L2 9z" fill="#ff5fa2" />
      <path d="M2 9h20L12 21z" fill="#c8327a" />
      <path d="M7 3l2.5 6L12 3l2.5 6L17 3z" fill="#ff9ccb" />
      <path d="M9.5 9h5L12 21z" fill="#e2468e" />
      <path
        d="M7 3h10l5 6-10 12L2 9z"
        fill="none"
        stroke="#7a1f52"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.2" r="1" fill="#fff" />
    </svg>
  );
}
