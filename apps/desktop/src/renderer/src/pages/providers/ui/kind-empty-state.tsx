import type { ReactNode } from 'react';

type KindEmptyStateProps = {
  /** What the kind is, in one sentence, so the first connect is never a guess. */
  explanation: string;
  /** The heading the state reads under, which the kind owns because each kind ends somewhere different. */
  title: string;
  /** The one act the state offers, absent where nothing can be connected yet. */
  action?: ReactNode;
};

/**
 * What stands where the rows would be when a kind holds nothing yet.
 *
 * @summary Reach for it from any providers surface with an empty list. The sentence names what the
 * kind is before the screen asks for one, and the act stands alone when it stands at all, so the
 * screen never asks a person to choose their first move. The dashed edge draws the outline of the
 * list that isn't there yet, so the space reads as reserved rather than unfinished.
 */
export function KindEmptyState({ explanation, title, action }: KindEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
      <h2 className="text-heading text-ink">{title}</h2>
      <p className="max-w-prose text-body text-ink-secondary">{explanation}</p>
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}
