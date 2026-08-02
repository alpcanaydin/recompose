import { useState } from 'react';

import type { AccountKind } from '../../../entities/account';

import { accountKindTitle } from '../../../entities/account';
import { CredentialedSurface } from './credentialed-surface';
import { LocalRuntimesNote } from './local-runtimes-note';
import { ProviderCatalogDrawer } from './provider-catalog-drawer';
import { SubscriptionsSurface } from './subscriptions-surface';

type ProvidersPageProps = {
  /** The kind a sidebar row narrowed the surface to, which the route always supplies. */
  kind: AccountKind;
};

const subtitles: Record<AccountKind, string> = {
  subscription: "Plans each provider's own command-line tool signs in and spends.",
  'api-key': 'Keys a gateway reaches one provider with, charged request by request.',
  aggregator: 'One key that reaches many providers through a single endpoint.',
  local: 'Models this machine serves itself.',
};

function kindSurface(kind: AccountKind, onAddProvider: () => void) {
  if (kind === 'local') {
    return <LocalRuntimesNote onAddProvider={onAddProvider} />;
  }

  if (kind === 'subscription') {
    return <SubscriptionsSurface onAddProvider={onAddProvider} />;
  }

  return <CredentialedSurface kind={kind} onAddProvider={onAddProvider} />;
}

/**
 * The accounts held under one kind, over the catalog that adds another.
 *
 * @summary Reach for it from the providers route. Each kind reads as its own screen because the
 * kinds hold different things: a subscription is spent by a tool, a key is routed to by a
 * gateway, and a local runtime is neither yet. The catalog is the one way in for all of them, so
 * it opens beside whichever screen asked for it rather than replacing it.
 */
export function ProvidersPage({ kind }: ProvidersPageProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <section className="mx-auto flex w-full max-w-column flex-col gap-5 px-6 pt-page-top pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-ink">{accountKindTitle(kind)}</h1>
        <p className="text-body text-ink-secondary">{subtitles[kind]}</p>
      </header>
      {kindSurface(kind, () => {
        setCatalogOpen(true);
      })}
      <ProviderCatalogDrawer onOpenChange={setCatalogOpen} open={catalogOpen} />
    </section>
  );
}
