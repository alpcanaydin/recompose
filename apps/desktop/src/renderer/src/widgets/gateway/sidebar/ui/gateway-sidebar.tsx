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

const NEW_GATEWAY = 'New Gateway…';

/** The invitation while the group lists nothing, where a row has the space to name itself. */
function NewGatewayRow({ onNewGateway }: GatewaySidebarProps) {
  return (
    <button
      className="nav-item text-start font-medium text-accent-ink focus-ring"
      onClick={onNewGateway}
      type="button"
    >
      <Icon className="size-3.5 icon-emphasis" name="plus" />
      {NEW_GATEWAY}
    </button>
  );
}

/**
 * The same act once gateways are listed, drawn on the heading rather than under the list.
 *
 * @summary A row below a list reads as a member of that list, so the act moves to the trailing
 * edge of the heading the way a source list does. It keeps the row's name, so a screen reader
 * and a scenario both hear the same thing in either shape.
 */
function NewGatewayMark({ onNewGateway }: GatewaySidebarProps) {
  return (
    <button
      aria-label={NEW_GATEWAY}
      className="me-2 mb-0.5 flex size-5 items-center justify-end text-accent-ink focus-ring"
      onClick={onNewGateway}
      type="button"
    >
      <Icon className="size-3.5 icon-emphasis" name="plus" />
    </button>
  );
}

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
    <div aria-labelledby={groupId} className="flex flex-col" role="group">
      <div className="flex items-end">
        <h2 className="flex-1 nav-group" id={groupId}>
          Local Gateways
        </h2>
        {gateways.length > 0 && <NewGatewayMark onNewGateway={onNewGateway} />}
      </div>
      {gateways.length === 0 && <NewGatewayRow onNewGateway={onNewGateway} />}
      {gateways.map((gateway) => (
        <a className="nav-item text-ink" href={`#/gateways/${gateway.slug}`} key={gateway.slug}>
          <Icon name="network" />
          <span className="truncate">{gateway.displayName}</span>{' '}
          <span className="ms-auto flex">
            <StatusIndicator status={gatewayStateIn(states, gateway.slug).status} />
          </span>
        </a>
      ))}
    </div>
  );
}
