import { useSuspenseQuery } from '@tanstack/react-query';

import { subscriptionsQueryOptions } from '../../../shared/api';
import { AddProviderButton } from './add-provider-button';
import { SubscriptionAccountRow } from './subscription-account-row';
import { SubscriptionsEmptyState } from './subscriptions-empty-state';

type SubscriptionsSurfaceProps = {
  /** Asks for the catalog, which the page owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/** The subscription accounts this machine holds, or the state explaining the kind before one exists. */
export function SubscriptionsSurface({ onAddProvider }: SubscriptionsSurfaceProps) {
  const { data: views } = useSuspenseQuery(subscriptionsQueryOptions);

  if (views.length === 0) {
    return <SubscriptionsEmptyState onAddProvider={onAddProvider} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <AddProviderButton onAddProvider={onAddProvider} />
      <ul className="flex flex-col gap-2">
        {views.map((view) => (
          <SubscriptionAccountRow key={view.id} view={view} />
        ))}
      </ul>
    </div>
  );
}
