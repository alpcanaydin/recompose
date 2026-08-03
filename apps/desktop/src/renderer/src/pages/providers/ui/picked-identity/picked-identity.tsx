import type { ReactNode } from 'react';

import type { BrandMarkName } from '../../../../shared/ui';

import { BrandMark } from '../../../../shared/ui';

type PickedIdentityProps = {
  /** The provider whose mark heads the page, already settled by the picked entry. */
  provider: BrandMarkName;
  /** The product the entry was picked as, standing as the page's own heading. */
  title: string;
  /** One quiet line under the title, saying what the step reaches or spends. */
  children?: ReactNode;
};

/**
 * The picked product standing centered over a connect step.
 *
 * @summary Reach for it at the head of either connect step, so the page says whose account it
 * takes in one anatomy: the mark in its raised square, the product as the heading, and one line
 * under it carrying the step's own context.
 */
export function PickedIdentity({ provider, title, children }: PickedIdentityProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <span className="flex size-11 items-center justify-center rounded-card border border-line-subtle bg-surface-raised">
        <BrandMark className="size-6" name={provider} />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-heading text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
