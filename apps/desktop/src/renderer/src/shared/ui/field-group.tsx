import type { ReactNode } from 'react';

import { useId } from 'react';

type FieldGroupProps = {
  /** Overline heading naming the section, and the accessible name of the group. */
  heading: string;
  /** The rows the section stacks, in reading order. */
  children: ReactNode;
};

/**
 * A titled stack of related settings on one card.
 *
 * @summary Reach for it to give a run of rows a heading a screen reader can jump to.
 */
export function FieldGroup({ heading, children }: FieldGroupProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2" role="group">
      <h2 className="px-3 text-overline text-ink uppercase" id={headingId}>
        {heading}
      </h2>
      <div className="divide-y divide-line-subtle rounded-card border border-line-subtle bg-surface-card px-3">
        {children}
      </div>
    </section>
  );
}
