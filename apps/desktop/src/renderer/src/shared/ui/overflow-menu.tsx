import { Menu } from '@base-ui/react/menu';

import { Icon } from './icon';

type OverflowAction = {
  /** What the action reads as, which is also the name it answers to. */
  label: string;
  /** Runs when a person chooses this action. */
  onSelect: () => void;
};

type OverflowMenuProps = {
  /** Accessible name of the control, naming what these actions act on. */
  label: string;
  /** The actions, in reading order. */
  items: readonly OverflowAction[];
};

/**
 * The rest of a row's actions, held behind one control at its trailing edge.
 *
 * @summary Reach for it when a row offers more than the one or two acts that earn their own
 * control. The act a person reaches for most often belongs on the row itself, and everything
 * quieter belongs here.
 */
export function OverflowMenu({ label, items }: OverflowMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="flex size-6 items-center justify-center rounded-control text-ink-secondary focus-ring hover:bg-surface-hover active:bg-surface-pressed"
      >
        <Icon className="size-4" name="more" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4}>
          <Menu.Popup className="menu-surface">
            {items.map((action) => (
              <Menu.Item
                className="menu-action"
                key={action.label}
                onClick={() => {
                  action.onSelect();
                }}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
