import { Switch as BaseSwitch } from '@base-ui/react/switch';

type SwitchProps = {
  /** Accessible name the control keeps in both states. */
  label: string;
  /** Controlled on or off state. */
  checked: boolean;
  /** Receives the state the person asked for. */
  onChangeChecked: (checked: boolean) => void;
  /** Marks a setting whose machinery is missing, keeping the control reachable but unmovable. */
  inert?: boolean;
  /** Identifier of the element explaining the setting or why it can't move. */
  describedBy?: string;
};

/**
 * Binary setting control for a value that applies the moment it changes.
 *
 * @summary Reach for it whenever a setting reads as on or off with no save step.
 */
export function Switch({
  label,
  checked,
  onChangeChecked,
  inert = false,
  describedBy,
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      aria-describedby={describedBy}
      aria-disabled={inert || undefined}
      aria-label={label}
      checked={checked}
      className="flex h-[22px] w-[36px] shrink-0 rounded-pill border border-line-subtle bg-line-strong p-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:border-line-faint aria-disabled:bg-surface-inert data-checked:border-accent data-checked:bg-accent"
      onCheckedChange={(next) => {
        if (inert) {
          return;
        }

        onChangeChecked(next);
      }}
    >
      <BaseSwitch.Thumb className="size-[16px] rounded-pill bg-surface-card transition-transform data-checked:translate-x-3.5" />
    </BaseSwitch.Root>
  );
}
