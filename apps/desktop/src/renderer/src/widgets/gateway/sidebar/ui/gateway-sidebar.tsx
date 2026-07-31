import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import {
  engineStatesQueryOptions,
  gatewayStateIn,
  gatewaysQueryOptions,
} from '../../../../shared/api';
import { Icon, StatusIndicator } from '../../../../shared/ui';

type GatewaySidebarProps = {
  /** Asked for when a person wants a gateway beyond the ones already listed. */
  onNewGateway: () => void;
};

/**
 * The stored gateways, each row reporting whether it serves, over the way to the next one.
 *
 * @summary Reach for it in the app shell's sidebar. The group only appears once a gateway
 * exists, because the empty state already carries the invitation to make the first one.
 */
export function GatewaySidebar({ onNewGateway }: GatewaySidebarProps) {
  const groupId = useId();
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);
  const { data: states } = useSuspenseQuery(engineStatesQueryOptions);

  if (gateways.length === 0) {
    return null;
  }

  return (
    <div aria-labelledby={groupId} className="flex flex-col" role="group">
      <h2 className="nav-group" id={groupId}>
        Local Gateways
      </h2>
      {gateways.map((gateway) => (
        <a className="nav-item text-ink" href={`#/gateways/${gateway.slug}`} key={gateway.slug}>
          <Icon name="network" />
          <span className="truncate">{gateway.displayName}</span>{' '}
          <span className="ms-auto flex">
            <StatusIndicator status={gatewayStateIn(states, gateway.slug).status} />
          </span>
        </a>
      ))}
      <button
        className="nav-item text-start font-medium text-accent-ink"
        onClick={onNewGateway}
        type="button"
      >
        <Icon className="size-3.5 icon-emphasis" name="plus" />
        New Gateway…
      </button>
    </div>
  );
}
