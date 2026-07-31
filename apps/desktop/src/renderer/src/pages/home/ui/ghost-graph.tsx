/**
 * The shape of a gateway that does not exist yet, drawn as an outline over the invitation.
 *
 * @summary Reach for it above the empty state's call to action. It carries no information a
 * reader needs, so it stays out of the accessibility tree entirely.
 */
export function GhostGraph() {
  return (
    <svg
      aria-hidden
      className="mb-6.5 h-ghost-height w-ghost-width shrink-0 opacity-75"
      fill="none"
      viewBox="0 0 436 96"
    >
      <g stroke="var(--color-line-strong)" strokeDasharray="4 4" strokeWidth="1">
        <rect height="52" rx="8" width="150" x="8" y="22" />
        <rect height="52" rx="8" width="150" x="278" y="22" />
        <path d="M158 48h120" />
      </g>
      <g
        className="text-caption"
        fill="var(--color-ink-tertiary)"
        fontFamily="var(--font-sans)"
        textAnchor="middle"
      >
        <text x="83" y="52">
          Gateway
        </text>
        <text x="353" y="52">
          Virtual Model
        </text>
      </g>
    </svg>
  );
}
