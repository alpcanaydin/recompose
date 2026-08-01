import type { ReactNode } from 'react';

type BadgeProps = {
  /** The short word the badge prints, such as the plan an account holds. */
  children: ReactNode;
};

/**
 * A short label riding beside a name, quieter and smaller than the note under it.
 *
 * @summary Reach for it when one word qualifies the name it follows and a person reads the name
 * first. It carries no state and no action, so it stays part of the name it rides with rather than
 * becoming something to press.
 */
export function Badge({ children }: BadgeProps) {
  return (
    <span className="inline-flex h-4 items-center rounded-chip bg-surface-inert px-1.25 text-caption font-medium text-ink-secondary">
      {children}
    </span>
  );
}
