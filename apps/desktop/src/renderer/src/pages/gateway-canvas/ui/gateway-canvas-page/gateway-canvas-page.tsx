import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';

import { gatewaysQueryOptions } from '../../../../shared/api';
import { GatewayDrawer } from '../gateway-drawer/gateway-drawer';
import { GatewayStage } from '../gateway-stage/gateway-stage';

/**
 * The selected gateway: the stage it will be composed on, and the inspector that changes it.
 *
 * @summary Reach for it from the gateway route. The stage carries the gateway itself and the drawer
 * carries everything a person reads or changes about it, so the surface reads the way it will once
 * the canvas grows nodes rather than being rearranged when it does. A slug no stored gateway holds
 * lands on the same not-found state a mistyped address does, because a gateway that was deleted and
 * one that never existed are the same fact to the person reading, and a blank surface says neither.
 */
export function GatewayCanvasPage({ slug }: { slug: string }) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);

  const gateway = gateways.find((held) => held.slug === slug);

  if (gateway === undefined) {
    throw notFound();
  }

  return (
    <div className="flex h-full min-h-0">
      <GatewayStage gateway={gateway} />
      <GatewayDrawer gateway={gateway} />
    </div>
  );
}
