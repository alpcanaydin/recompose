import type { EngineGateway } from '@recompose/contracts';

import { listGatewayConfigs } from '../storage/gateway-store';

/**
 * The engine's view of one stored gateway, or nothing when no document carries that slug.
 *
 * @summary Main is the single reader of the gateways directory, so the toolbar, the menu bar,
 * and the move recovery all learn a gateway's port the same way.
 */
export async function storedEngineGateway(
  gatewaysDir: string,
  onCorrupt: (quarantinedPath: string) => void,
  slug: string,
): Promise<EngineGateway | undefined> {
  const stored = await listGatewayConfigs(gatewaysDir, onCorrupt);
  const found = stored.find((config) => config.slug === slug);

  if (found === undefined) {
    return undefined;
  }

  return { slug: found.slug, displayName: found.displayName, port: found.port };
}
