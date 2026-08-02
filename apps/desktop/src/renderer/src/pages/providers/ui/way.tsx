import type { ReactNode } from 'react';

import { useId } from 'react';

/** One way of connecting, named after what it yields so the name reaches assistive technology. */
export function Way({ yields, children }: { yields: string; children: ReactNode }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface-card p-4"
    >
      <h3 className="text-card-title text-ink" id={titleId}>
        {yields}
      </h3>
      {children}
    </section>
  );
}
