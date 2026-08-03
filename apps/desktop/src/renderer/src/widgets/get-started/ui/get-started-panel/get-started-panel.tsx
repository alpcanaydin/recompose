import type { ReactNode } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useId, useSyncExternalStore } from 'react';

import { accountsQueryOptions, gatewaysQueryOptions } from '../../../../shared/api';
import { getStartedCollapsed, subscribeToGetStartedCollapse } from '../../lib/get-started-collapse';
import {
  getStartedDismissed,
  restoreGetStarted,
  subscribeToGetStartedDismissal,
} from '../../lib/get-started-dismissal';
import { getStartedSteps } from '../../lib/get-started-steps';
import { ChecklistHeader } from '../checklist-header/checklist-header';
import { ChecklistSteps } from '../checklist-steps/checklist-steps';

type GetStartedPanelProps = {
  /** Names a fresh ask for the checklist, which clears any earlier dismissal. */
  restoreRequest?: string | undefined;
};

function progressLine(done: number, total: number): ReactNode {
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
      {progressLine(done, steps.length)}
      <div
        className={`fold-rows ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
        inert={collapsed || undefined}
        style={{ visibility: collapsed ? 'hidden' : 'visible' }}
      >
        <div className="min-h-0 overflow-hidden">
          <ChecklistSteps steps={steps} />
        </div>
      </div>
    </section>
  );
}
