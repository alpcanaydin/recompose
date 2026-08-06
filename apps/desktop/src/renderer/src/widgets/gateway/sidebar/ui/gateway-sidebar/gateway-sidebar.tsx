import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';

import {
  engineStatesQueryOptions,
  gatewayStateIn,
  gatewaysQueryOptions,
} from '../../../../../shared/api';
import { Icon, StatusIndicator } from '../../../../../shared/ui';

type GatewaySidebarProps = {
  /** Asked for when a person wants a gateway beyond the ones already listed. */
  onNewGateway: () => void;
};

/**
 * The way to the next gateway, over the stored ones, each row reporting whether it serves.
 *
 * @summary Reach for it in the app shell's sidebar. The group stands whether or not a gateway
 * exists, so a fresh install still shows where gateways will land and how to make the first.
 */
export function GatewaySidebar({ onNewGateway }: GatewaySidebarProps) {
  const groupId = useId();
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const { data: states } = useSuspenseQuery(engineStatesQueryOptions);

  return (
    <div aria-labelledby={groupId} className="flex flex-col gap-px" role="group">
      <h2 className="nav-group" id={groupId}>
        Local Gateways
      </h2>
      {gateways.map((gateway) => (
        <Link
          data-panel-control=""
          className="nav-item"
          key={gateway.slug}
          params={{ slug: gateway.slug }}
          to="/gateways/$slug"
        >
          <Icon name="network" />
          <span className="truncate">{gateway.displayName}</span>{' '}
          <span className="ms-auto flex">
            <StatusIndicator status={gatewayStateIn(states, gateway.slug).status} />
          </span>
        </Link>
      ))}
      <button
        className="nav-item-action text-start focus-ring"
        onClick={onNewGateway}
        type="button"
      >
        <Icon className="size-3.5 icon-emphasis" name="plus" />
        New Gateway…
      </button>
    </div>
  );
}
