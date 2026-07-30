import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';

import {
  engineStatesQueryOptions,
  gatewayStateIn,
  gatewaysQueryOptions,
} from '../../../../shared/api';
import { StatusIndicator } from '../../../../shared/ui';

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
    <div aria-labelledby={groupId} className="flex flex-col gap-2" role="group">
      <h2 className="text-overline text-ink uppercase" id={groupId}>
        Local Gateways
      </h2>
      {gateways.map((gateway) => (
        <a
          className="nav-item flex items-center gap-2"
          href={`#/gateways/${gateway.slug}`}
          key={gateway.slug}
        >
          <span className="truncate">{gateway.displayName}</span>{' '}
          <StatusIndicator status={gatewayStateIn(states, gateway.slug).status} />
        </a>
      ))}
      <button className="nav-item text-start" onClick={onNewGateway} type="button">
        New Gateway…
      </button>
    </div>
  );
}
