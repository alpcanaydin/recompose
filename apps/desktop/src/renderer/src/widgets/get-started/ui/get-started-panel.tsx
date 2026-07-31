import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useId, useSyncExternalStore } from 'react';

import { accountsQueryOptions, gatewaysQueryOptions } from '../../../shared/api';
import { Icon } from '../../../shared/ui';
import {
  collapseGetStarted,
  expandGetStarted,
  getStartedCollapsed,
  subscribeToGetStartedCollapse,
} from '../lib/get-started-collapse';
import {
  dismissGetStarted,
  getStartedDismissed,
  restoreGetStarted,
  subscribeToGetStartedDismissal,
} from '../lib/get-started-dismissal';
import { type GetStartedStep, getStartedSteps } from '../lib/get-started-steps';

type GetStartedPanelProps = {
  /** Names a fresh ask for the checklist, which clears any earlier dismissal. */
  restoreRequest?: string | undefined;
};

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

function StepRow({ step }: { step: GetStartedStep }) {
  return (
    <li className="flex min-h-7.5 items-center gap-2.25 px-0.5">
      <span aria-hidden className={`checklist-ring ${ring[step.state]}`}>
        {step.state === 'done' && <Icon className="size-2.25 stroke-3" name="check" />}
      </span>
      <span className={`flex flex-col ${stepInk[step.state]}`}>
        <span aria-current={step.state === 'current' ? 'step' : undefined} className="text-note">
          {step.title}
        </span>
        {step.reason !== undefined && (
          <span className="text-caption text-ink-secondary">{step.reason}</span>
        )}
      </span>
    </li>
  );
}

function ChecklistHeader({ headingId, collapsed }: { headingId: string; collapsed: boolean }) {
  return (
    <h2 className="text-card-title text-ink" id={headingId}>
      <button
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between px-0.5 focus-ring"
        onClick={collapsed ? expandGetStarted : collapseGetStarted}
        type="button"
      >
        Get started
        <Icon
          className={`size-3.5 text-ink-secondary ${collapsed ? '-rotate-90' : ''}`}
          name="chevron"
        />
      </button>
    </h2>
  );
}

function ProgressLine({ done, total }: { done: number; total: number }) {
  return (
    <p className="mt-1 flex items-center gap-2 px-0.5">
      <span className="font-mono text-mono-value text-ink-secondary">
        {`${String(done)} of ${String(total)}`}
      </span>
      <span aria-hidden className="h-1 flex-1 rounded-full bg-surface-track">
        <span
          className="block h-full rounded-full bg-running"
          style={{ inlineSize: `${String((done / total) * 100)}%` }}
        />
      </span>
    </p>
  );
}

function ChecklistSteps({ steps }: { steps: readonly GetStartedStep[] }) {
  return (
    <>
      <ul className="mt-1 list-none">
        {steps.map((step) => (
          <StepRow key={step.title} step={step} />
        ))}
      </ul>
      <footer className="mt-1.25 flex justify-end border-t border-line-faint px-0.5 py-1.75">
        <button
          className="text-quiet text-ink-secondary focus-ring hover:text-ink"
          onClick={dismissGetStarted}
          type="button"
        >
          Skip setup
        </button>
      </footer>
    </>
  );
}

/**
 * The four steps of a first session, folded into the foot of the sidebar.
 *
 * @summary Reach for it from the shell, where it stands under the navigation on every surface
 * rather than floating over one. It coaches rather than stalls: the steps this build cannot
 * finish say what they wait for instead of pretending to be next. Folded, it keeps the header
 * and the progress line, which is enough to say how far a session has come.
 */
export function GetStartedPanel({ restoreRequest }: GetStartedPanelProps) {
  const headingId = useId();
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);
  const dismissed = useSyncExternalStore(subscribeToGetStartedDismissal, getStartedDismissed);
  const collapsed = useSyncExternalStore(subscribeToGetStartedCollapse, getStartedCollapsed);

  useEffect(() => {
    if (restoreRequest !== undefined) {
      restoreGetStarted();
    }
  }, [restoreRequest]);

  if (dismissed) {
    return null;
  }

  const steps = getStartedSteps({
    gatewayExists: gateways.length > 0,
    providerConnected: registry.accounts.length > 0,
  });
  const done = steps.filter((step) => step.state === 'done').length;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-panel border border-line-subtle bg-surface-card px-3 pt-2.5 pb-1.5"
    >
      <ChecklistHeader collapsed={collapsed} headingId={headingId} />
      <ProgressLine done={done} total={steps.length} />
      {!collapsed && <ChecklistSteps steps={steps} />}
    </section>
  );
}
