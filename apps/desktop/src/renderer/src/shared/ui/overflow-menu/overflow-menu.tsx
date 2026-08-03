import { Menu } from '@base-ui/react/menu';

import type { IconName } from '../icon/icon';

import { Icon } from '../icon/icon';

type OverflowTone = 'accent' | 'danger' | 'positive';

type OverflowAction = {
  /** What the action reads as, which is also the name it answers to. */
  label: string;
  /** Glyph drawn leading the label, so the acts scan without reading. */
  icon?: IconName | undefined;
  /** Ink the glyph carries at rest; a highlighted act repaints it in the highlight's own ink. */
  tone?: OverflowTone | undefined;
  /** Runs when a person chooses this action. */
  onSelect: () => void;
};

const toneInk: Record<OverflowTone, string> = {
  accent: 'text-accent-ink',
  danger: 'text-danger-ink',
  positive: 'text-running',
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
                className="group menu-action"
                key={action.label}
                onClick={() => {
                  action.onSelect();
                }}
              >
                {action.icon === undefined ? null : (
                  <Icon
                    className={`size-4 group-data-highlighted:text-highlight-ink ${
                      action.tone === undefined ? 'text-ink-secondary' : toneInk[action.tone]
                    }`}
                    name={action.icon}
                  />
                )}
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
