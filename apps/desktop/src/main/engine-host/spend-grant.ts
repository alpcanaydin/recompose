import type { LookCustody, SpendGrant, Target } from '@recompose/contracts';

import type { StoragePaths } from '../ipc/storage-context';
import type { TargetCustodyContext } from './target-custody';

import { storagePathsFor } from '../ipc/storage-context';
import { listGatewayConfigs } from '../storage/gateway-store';
import { resolveTargetCustody } from './target-custody';

export type SpendGrantContext = TargetCustodyContext;

async function storedTarget(
  paths: StoragePaths,
  onCorrupt: (quarantinedPath: string) => void,
  slug: string,
  virtualModel: string,
): Promise<Target | undefined> {
  const stored = await listGatewayConfigs(paths.gatewaysDir, onCorrupt);
  const serving = stored.find((config) => config.slug === slug);

  return serving?.virtualModels.find((model) => model.id === virtualModel)?.target;
}

type GrantedSpend = Extract<SpendGrant, { verdict: 'resolved' }>['spend'];

/**
 * What a turn spends, out of how the credential opening the target is spelled.
 *
 * @summary A turn carries the credential to the child and lets the proxy write the header, so the
 * spend says only whether one is in hand. Which header a vendor reads is the model-list look's
 * business, and folding it away here keeps the serving wire as narrow as it always was.
 */
function spendFrom(custody: LookCustody): GrantedSpend {
  if (custody.custody === 'open') {
    return { custody: 'open' };
  }

  return custody.custody === 'subscription'
    ? custody
    : { custody: 'credentialed', credential: custody.credential };
}

/**
 * What one turn may be spent against, resolved against live storage for every request.
 *
 * @summary The gateway document names the account, and the account may be gone or may have turned
 * out to be a subscription by the time the gateway serves, so the target is resolved per request
 * rather than trusted from the start directive. The secret lives in this call's scope and in the
 * message that answers the child, and nowhere else.
 */
export async function resolveSpendGrant(
  ctx: SpendGrantContext,
  slug: string,
  virtualModel: string,
): Promise<SpendGrant> {
  const paths = storagePathsFor(ctx.userDataPath);
  const target = await storedTarget(paths, ctx.onCorrupt, slug, virtualModel);

  if (target === undefined) {
    return { verdict: 'missing-target' };
  }

  const resolved = await resolveTargetCustody(ctx, target.accountId);

  return resolved.verdict === 'resolved'
    ? {
        verdict: 'resolved',
        providerOrigin: resolved.providerOrigin,
        spend: spendFrom(resolved.custody),
      }
    : resolved;
}
