import { Icon } from '../../../../shared/ui';
import { collapseGetStarted, expandGetStarted } from '../../lib/get-started-collapse';

type ChecklistHeaderProps = {
  /** Identifier the section reads its accessible name from. */
  headingId: string;
  /** Whether the checklist stands folded to its header and progress line. */
  collapsed: boolean;
};

/** The heading of the checklist, doubling as the control that folds it. */
export function ChecklistHeader({ headingId, collapsed }: ChecklistHeaderProps) {
  return (
    <h2 className="text-card-title text-ink" id={headingId}>
      <button
        aria-expanded={!collapsed}
        className="group flex w-full items-center justify-between px-0.5 focus-ring"
        onClick={collapsed ? expandGetStarted : collapseGetStarted}
        type="button"
      >
        Get started
        <span className="flex size-6 items-center justify-center rounded-control transition-colors group-hover:bg-surface-hover group-active:bg-surface-pressed">
          <Icon
            className={`size-3.5 text-ink-secondary transition-transform duration-150 motion-reduce:transition-none ${collapsed ? '-rotate-90' : ''}`}
            name="chevron"
          />
        </span>
      </button>
    </h2>
  );
}
