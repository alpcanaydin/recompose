import { useSuspenseQuery } from '@tanstack/react-query';

import { gatewaysQueryOptions } from '../../../shared/api';
import { EmptyState } from './empty-state';
import { NoGatewayChosen } from './no-gateway-chosen';

type HomePageProps = {
  /** Asked for when the person wants the creation sheet. */
  onCreateGateway: () => void;
};

/**
 * The surface behind no gateway at all, carrying the invitation to make the first one.
 *
 * @summary Reach for it from the root route. Nothing sends a person here once a gateway exists,
 * because a launch opens the one they were last looking at, so this is a first session's surface
 * and the way back when the last gateway has gone.
 */
export function HomePage({ onCreateGateway }: HomePageProps) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);

  return (
    <div className="relative h-full dot-grid">
      {gateways.length === 0 ? (
        <EmptyState onCreateGateway={onCreateGateway} />
      ) : (
        <NoGatewayChosen />
      )}
    </div>
  );
}
