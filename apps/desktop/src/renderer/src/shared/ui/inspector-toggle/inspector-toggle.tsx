import { useSyncExternalStore } from 'react';

import { inspectorOpen, subscribeToInspectorVisibility, toggleInspector } from '../../lib';
import { Icon } from '../icon/icon';
import { toolbarShape } from '../toolbar-shape';

const STATES =
  'hover:not-disabled:bg-surface-hover active:not-disabled:bg-surface-pressed disabled:text-ink-tertiary aria-expanded:bg-surface-pressed aria-expanded:text-ink';

type InspectorToggleProps = {
  /** Whether the surface behind carries an inspector at all, which most surfaces do not. */
  available: boolean;
  /** Whether the control stands alone in the strip or inside a button group, as the others do. */
  where: keyof typeof toolbarShape;
};

/**
 * The control that opens the selected gateway's inspector and puts it away.
 *
 * @summary It answers the same state the gateway node does, so the two can never disagree about
 * whether the drawer stands, and pressing either one moves both. A surface carrying no inspector
 * keeps the control in place and unmovable rather than dropping it, so the strip holds its shape
 * as a person moves between surfaces.
 */
export function InspectorToggle({ available, where }: InspectorToggleProps) {
  const open = useSyncExternalStore(subscribeToInspectorVisibility, inspectorOpen);
  const standing = available && open;

  return (
    <button
      data-panel-control=""
      aria-expanded={standing}
      aria-label="Inspector"
      className={`flex items-center justify-center text-ink-secondary focus-ring ${STATES} ${toolbarShape[where]}`}
      disabled={!available}
      onClick={toggleInspector}
      type="button"
    >
      <Icon className="size-4" name="panel-right" />
    </button>
  );
}
