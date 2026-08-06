import { useSuspenseQuery } from '@tanstack/react-query';

import { gatewaysQueryOptions } from '../../../../shared/api';
import { GatewayDrawer } from '../gateway-drawer/gateway-drawer';
import { GatewayStage } from '../gateway-stage/gateway-stage';

/**
 * The selected gateway: the stage it will be composed on, and the inspector that changes it.
 *
 * @summary Reach for it from the gateway route. The stage carries the gateway itself and the drawer
 * carries everything a person reads or changes about it, so the surface reads the way it will once
 * the canvas grows nodes rather than being rearranged when it does. A slug no stored gateway holds
 * renders nothing, because the route it came from is the only thing that can answer for it.
 */
export function GatewayCanvasPage({ slug }: { slug: string }) {
  const { data: gateways } = useSuspenseQuery(gatewaysQueryOptions);

  const gateway = gateways.find((held) => held.slug === slug);

  if (gateway === undefined) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0">
      <GatewayStage gateway={gateway} />
      <GatewayDrawer gateway={gateway} />
    </div>
  );
}
