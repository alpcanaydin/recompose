import type { ReactNode, Ref } from 'react';

const toneClasses = {
  plain: 'push-button focus-ring',
  destructive: 'push-button border-danger text-danger-ink focus-ring',
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
