import { createServer, type Server } from 'node:net';

import { offerFreePort } from './free-port';

const IPV4_LOOPBACK = '127.0.0.1';
const IPV6_LOOPBACK = '::1';

export type LoopbackBind = 'bound' | { refusedWith: string };

type HeldPort = { held: Server } | { refusedWith: string };

/**
 * Whether the two loopback binds a gateway needs would let it take the port.
 *
 * @summary A gateway takes both loopback families, and it survives an IPv6 loopback the machine
 * cannot offer, so only a held IPv6 port keeps it out. ADR-0014 keeps the engine package out of
 * this process, which is why the rule beside the listener is written again here.
 */
export function aGatewayCouldTake(overIpv4: LoopbackBind, overIpv6: LoopbackBind): boolean {
  return overIpv4 === 'bound' && (overIpv6 === 'bound' || overIpv6.refusedWith !== 'EADDRINUSE');
}

async function holdLoopback(address: string, port: number): Promise<HeldPort> {
  return new Promise<HeldPort>((settle) => {
    const probe = createServer();

    probe.once('error', (error: NodeJS.ErrnoException) => {
      settle({ refusedWith: error.code ?? error.message });
    });
    probe.listen({ port, host: address }, () => {
      settle({ held: probe });
    });
  });
}

async function letGo(holding: HeldPort): Promise<LoopbackBind> {
  if (!('held' in holding)) {
    return holding;
  }

  return new Promise<LoopbackBind>((released) => {
    holding.held.close(() => {
      released('bound');
    });
  });
}

async function loopbackPortIsFree(port: number): Promise<boolean> {
  const [heldOverIpv4, heldOverIpv6] = await Promise.all([
    holdLoopback(IPV4_LOOPBACK, port),
    holdLoopback(IPV6_LOOPBACK, port),
  ]);
  const [overIpv4, overIpv6] = await Promise.all([letGo(heldOverIpv4), letGo(heldOverIpv6)]);

  return aGatewayCouldTake(overIpv4, overIpv6);
}

export async function probeFreePort(
  taken: ReadonlySet<number>,
  installFolder: string,
): Promise<number> {
  return offerFreePort(taken, installFolder, loopbackPortIsFree);
}
