import type {
  Account,
  EngineGateway,
  EngineVirtualModel,
  GatewayConfig,
  Target,
  VirtualModel,
} from '@recompose/contracts';

import { storagePathsFor } from '../ipc/storage-context';
import { loadAccountsFile } from '../storage/accounts-store';
import { listGatewayConfigs } from '../storage/gateway-store';

function standingOf(accounts: readonly Account[], target: Target): EngineVirtualModel['target'] {
  const held = accounts.find((account) => account.id === target.accountId);

  return held === undefined || held.kind === 'subscription'
    ? { standing: 'removed' }
    : { standing: 'bound', providerModel: target.providerModel };
}

function mintedAgainst(
  accounts: readonly Account[],
  stored: readonly VirtualModel[],
): EngineVirtualModel[] {
  return stored.map((model) => ({
    id: model.id,
    displayName: model.displayName,
    target: standingOf(accounts, model.target),
  }));
}

/**
 * The engine's view of one gateway document, with every target resolved against the registry.
 *
 * @summary A stored target names an account, and the account may be gone or may have turned out to
 * be a subscription by the time the gateway serves, so the standing is minted here rather than
 * trusted from the document. The snapshot says which names serve and which refuse; it never carries
 * a credential, because a turn asks for one per request.
 */
export async function engineGatewayOf(
  userDataPath: string,
  onCorrupt: (quarantinedPath: string) => void,
  config: GatewayConfig,
): Promise<EngineGateway> {
  const registry = await loadAccountsFile(storagePathsFor(userDataPath).accountsFile, onCorrupt);

  return {
    slug: config.slug,
    displayName: config.displayName,
    port: config.port,
    virtualModels: mintedAgainst(registry.accounts, config.virtualModels),
  };
}

/**
 * The engine's view of the stored gateway under a slug, or nothing when no document carries it.
 *
 * @summary Main is the single reader of the gateways directory, so the toolbar, the menu bar,
 * and the move recovery all learn a gateway's port the same way.
 */
export async function storedEngineGateway(
  userDataPath: string,
  onCorrupt: (quarantinedPath: string) => void,
  slug: string,
): Promise<EngineGateway | undefined> {
  const stored = await listGatewayConfigs(storagePathsFor(userDataPath).gatewaysDir, onCorrupt);
  const found = stored.find((config) => config.slug === slug);

  if (found === undefined) {
    return undefined;
  }

  return engineGatewayOf(userDataPath, onCorrupt, found);
}
