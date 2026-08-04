import type { CatalogEntry, ConnectionWay } from '../../model/provider-catalog';

import { keyKindOf, signInProviderOf } from '../../model/provider-catalog';
import { ConnectKeyForm } from '../connect-key-form/connect-key-form';
import { SignInWay } from '../sign-in-way/sign-in-way';

type ProviderConnectWayProps = {
  /** The provider a person picked out of the catalog. */
  entry: CatalogEntry;
  /** The way the kind-locked catalog was opened for, which is the only way offered here. */
  way: ConnectionWay;
  /** Runs once the connect finishes, so the catalog can close behind it. */
  onConnected: () => void;
};

/**
 * The one way a picked provider connects under the kind the catalog was opened for.
 *
 * @summary Reach for it once a person picks a provider out of the kind-locked catalog. The way
 * is already settled by the screen that opened the catalog, so the surface asks only for what
 * that way still needs rather than explaining the ways it was not asked for.
 */
export function ProviderConnectWay({ entry, way, onConnected }: ProviderConnectWayProps) {
  if (way === 'subscription') {
    const provider = signInProviderOf(entry);

    return provider === undefined ? null : (
      <SignInWay name={entry.name} onConnected={onConnected} provider={provider} />
    );
  }

  const kind = keyKindOf(entry);

  return kind === undefined ? null : (
    <ConnectKeyForm kind={kind} onConnected={onConnected} provider={entry.id} />
  );
}
