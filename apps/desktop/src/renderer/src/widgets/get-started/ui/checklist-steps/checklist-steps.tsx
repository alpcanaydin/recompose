import type { GetStartedStep } from '../../lib/get-started-steps';

import { Icon } from '../../../../shared/ui';
import { dismissGetStarted } from '../../lib/get-started-dismissal';

const ring = {
  done: 'border-running bg-running text-surface-thumb',
  current: 'checklist-ring-current',
  pending: '',
} as const;

const stepInk = {
  done: 'text-ink-secondary',
  current: 'text-ink font-medium',
  pending: 'text-ink-secondary',
} as const;

type ChecklistStepsProps = {
  /** The steps in coaching order, each carrying its own state. */
  steps: readonly GetStartedStep[];
};

/** The step rows of the checklist, closed by the way out of the coaching altogether. */
export function ChecklistSteps({ steps }: ChecklistStepsProps) {
  return (
    <>
      <ul className="mt-1 list-none">
        {steps.map((step) => (
          <li className="flex min-h-7.5 items-center gap-2.25 px-0.5" key={step.title}>
            <span aria-hidden className={`checklist-ring ${ring[step.state]}`}>
              {step.state === 'done' && <Icon className="size-2.25 stroke-3" name="check" />}
            </span>
            <span className={`flex flex-col ${stepInk[step.state]}`}>
              <span
                aria-current={step.state === 'current' ? 'step' : undefined}
                className="text-body"
              >
                {step.title}
              </span>
              {step.reason !== undefined && (
                <span className="text-caption text-ink-secondary">{step.reason}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <footer className="mt-1.25 flex justify-end border-t border-line-faint px-0.5 py-1.75">
        <button
          className="text-detail text-ink-secondary focus-ring hover:text-ink"
          onClick={dismissGetStarted}
          type="button"
        >
          Skip setup
        </button>
      </footer>
    </>
  );
}
