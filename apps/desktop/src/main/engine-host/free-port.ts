import { createHash } from 'node:crypto';

export const GATEWAY_PORT_BAND = { first: 8389, count: 48 } as const;

const lastInBand = GATEWAY_PORT_BAND.first + GATEWAY_PORT_BAND.count - 1;

function bandPlaceOf(installFolder: string): number {
  return (
    createHash('sha256').update(installFolder).digest().readUInt32BE(0) % GATEWAY_PORT_BAND.count
  );
}

function bandFrom(installFolder: string): number[] {
  const place = bandPlaceOf(installFolder);

  return Array.from(
    { length: GATEWAY_PORT_BAND.count },
    (_unused, step) => GATEWAY_PORT_BAND.first + ((place + step) % GATEWAY_PORT_BAND.count),
  );
}

/**
 * The port a new gateway is offered.
 *
 * @summary The band belongs to recompose and sits below every ephemeral pool, so an address a
 * client copied still answers after a reboot. Where an install enters the band follows from its
 * own folder, so two installs on one machine never race for the same port.
 */
export async function offerFreePort(
  taken: ReadonlySet<number>,
  installFolder: string,
  portIsFree: (port: number) => Promise<boolean>,
): Promise<number> {
  for (const port of bandFrom(installFolder)) {
    if (!taken.has(port) && (await portIsFree(port))) {
      return port;
    }
  }

  throw new Error(
    `recompose gives gateways the ports ${String(GATEWAY_PORT_BAND.first)} through ${String(lastInBand)}, and a stored gateway or another process holds every one of them.`,
  );
}
