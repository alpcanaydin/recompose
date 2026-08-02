import type { CatalogEntry } from '../model/provider-catalog';

import { keyKindOf, signInProviderOf } from '../model/provider-catalog';
import { ConnectKeyForm } from './connect-key-form';
import { SignInWay } from './sign-in-way';
import { Way } from './way';

type ProviderConnectForkProps = {
  /** The provider a person picked out of the catalog. */
  entry: CatalogEntry;
  /** Runs once either way finishes, so the catalog can close behind it. */
  onConnected: () => void;
};

/**
 * Every way one provider connects, standing together with what each of them yields.
 *
 * @summary Reach for it once a person picks a provider out of the catalog. A provider that both
 * sells a plan and sells a key offers two different things rather than two routes to one thing,
 * so the arms name their yield and the person chooses, instead of the surface choosing for them.
 */
export function ProviderConnectFork({ entry, onConnected }: ProviderConnectForkProps) {
  const provider = signInProviderOf(entry);
  const kind = keyKindOf(entry);

  return (
    <div className="flex flex-col gap-3">
      {provider === undefined ? null : (
        <SignInWay name={entry.name} onConnected={onConnected} provider={provider} />
      )}
      {kind === undefined ? null : (
        <Way yields="A target a gateway can reach">
          <p className="text-detail text-ink-secondary">
            A key makes {entry.name} a target any virtual model can route to, charged to that key
            request by request.
          </p>
          <ConnectKeyForm kind={kind} onConnected={onConnected} provider={entry.id} />
        </Way>
      )}
    </div>
  );
}
