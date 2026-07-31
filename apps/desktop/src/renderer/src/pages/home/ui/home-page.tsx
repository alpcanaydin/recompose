import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { gatewaysQueryOptions } from '../../../shared/api';
import {
  dismissGetStarted,
  getStartedDismissed,
  restoreGetStarted,
  subscribeToGetStartedDismissal,
} from '../lib/get-started-dismissal';
import { EmptyState } from './empty-state';
import { GetStartedCard } from './get-started-card';

type HomePageProps = {
  /** Whether the app already holds a connected account, which the checklist reads. */
  providerConnected: boolean;
  /** Asked for when the person wants the creation sheet. */
  onCreateGateway: () => void;
  /** Names a fresh ask for the coaching card, which clears any earlier dismissal. */
  restoreRequest?: string | undefined;
};

/**
 * The gateways surface: an invitation while nothing exists, and coaching until it is unwanted.
 *
 * @summary Reach for it from the root route. It reads what the app holds rather than keeping a
 * record of its own, so a gateway made anywhere moves the checklist here.
 */
export function HomePage({ providerConnected, onCreateGateway, restoreRequest }: HomePageProps) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const dismissed = useSyncExternalStore(subscribeToGetStartedDismissal, getStartedDismissed);

  useEffect(() => {
    if (restoreRequest !== undefined) {
      restoreGetStarted();
    }
  }, [restoreRequest]);

  return (
    <div className="relative h-full">
      {gateways.length === 0 && <EmptyState onCreateGateway={onCreateGateway} />}
      {!dismissed && (
        <div className="absolute inset-e-4 bottom-4">
          <GetStartedCard
            gatewayExists={gateways.length > 0}
            onSkip={dismissGetStarted}
            providerConnected={providerConnected}
          />
        </div>
      )}
    </div>
  );
}
