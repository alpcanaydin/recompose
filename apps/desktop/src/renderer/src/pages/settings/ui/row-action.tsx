import type { ReactNode, Ref } from 'react';

const toneClasses = {
  plain:
    'h-control rounded-control border border-line-selected bg-surface-card px-2 text-control text-ink focus-ring',
  destructive:
    'h-control rounded-control border border-danger bg-surface-card px-2 text-control text-ink focus-ring',
};

type RowActionProps = {
  /** Text naming the act the button performs. */
  children: ReactNode;
  /** Performs the act. */
  onClick: () => void;
  /** Marks an act that destroys something, so it reads red. */
  tone?: keyof typeof toneClasses;
  /** Lets a confirmation put focus on the safe choice as it opens. */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * The small button a settings row carries beside its label.
 *
 * @summary Reach for it for a row-level act such as revealing a folder or minting a token.
 */
export function RowAction({ children, onClick, tone = 'plain', ref }: RowActionProps) {
  return (
    <button className={toneClasses[tone]} onClick={onClick} ref={ref} type="button">
      {children}
    </button>
  );
}
