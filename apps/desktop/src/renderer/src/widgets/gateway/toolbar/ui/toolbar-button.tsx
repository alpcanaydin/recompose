import type { IconName } from '../../../../shared/ui';

import { Icon } from '../../../../shared/ui';

const shape = {
  grouped: 'h-5.75 w-7.75 rounded-chip',
  standing: 'h-7.25 w-8.5 rounded-control border border-line-subtle bg-surface-raised',
} as const;

type ToolbarButtonProps = {
  glyph: IconName;
  label: string;
  onPress?: (() => void) | undefined;
  /** The ink the glyph takes, which the run control uses to carry its own state. */
  tone?: string;
  /** The surface it waits for, named for anyone who presses it before its machinery lands. */
  waitsFor?: string;
  where: keyof typeof shape;
};

/**
 * One control of the toolbar, whether it sits alone or inside a button group.
 *
 * @summary Every control in the strip comes from here, so a hover, a focus ring, or a size that
 * changes once changes for all of them.
 */
export function ToolbarButton({
  glyph,
  label,
  onPress,
  tone = 'text-ink-secondary',
  waitsFor,
  where,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex items-center justify-center focus-ring hover:bg-surface-hover active:bg-surface-pressed ${shape[where]} ${tone}`}
      onClick={onPress}
      title={waitsFor === undefined ? label : `${label}. Waits on ${waitsFor}.`}
      type="button"
    >
      <Icon className="size-4" name={glyph} />
    </button>
  );
}
