import { useSuspenseQuery } from '@tanstack/react-query';

import { subscriptionsQueryOptions } from '../../../shared/api';
import { SubscriptionAccountRow } from './subscription-account-row';
import { SubscriptionsEmptyState } from './subscriptions-empty-state';

/** The subscription accounts this machine holds, or the state explaining the kind before one exists. */
export function SubscriptionsSurface() {
  const { data: views } = useSuspenseQuery(subscriptionsQueryOptions);

  if (views.length === 0) {
    return <SubscriptionsEmptyState />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {views.map((view) => (
        <SubscriptionAccountRow key={view.id} view={view} />
      ))}
    </ul>
  );
}
