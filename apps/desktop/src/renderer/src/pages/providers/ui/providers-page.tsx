import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AccountKind } from '../../../entities/account';

import { accountKindTitle, accountsOfKind } from '../../../entities/account';
import { accountsQueryOptions, subscriptionsQueryOptions } from '../../../shared/api';
import { AccountList } from './account-list';
import { LocalRuntimesNote } from './local-runtimes-note';
import { ProviderCatalogDrawer } from './provider-catalog-drawer';
import { SubscriptionAccountRow } from './subscription-account-row';
import { SubscriptionsEmptyState } from './subscriptions-empty-state';

type ProvidersPageProps = {
  /** The kind a sidebar row narrowed the surface to, which the route always supplies. */
  kind: AccountKind;
};

type SurfaceProps = {
  onAddProvider: () => void;
};

const subtitles: Record<AccountKind, string> = {
  subscription: "Plans each provider's own command-line tool signs in and spends.",
  'api-key': 'Keys a gateway reaches one provider with, charged request by request.',
  aggregator: 'One key that reaches many providers through a single endpoint.',
  local: 'Models this machine serves itself.',
};

function AddProviderButton({ onAddProvider }: SurfaceProps) {
  return (
    <button className="push-button self-start focus-ring" onClick={onAddProvider} type="button">
      Add provider
    </button>
  );
}

function SubscriptionsSurface({ onAddProvider }: SurfaceProps) {
  const { data: views } = useSuspenseQuery(subscriptionsQueryOptions);

  if (views.length === 0) {
    return <SubscriptionsEmptyState onAddProvider={onAddProvider} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <AddProviderButton onAddProvider={onAddProvider} />
      <ul className="flex flex-col gap-2">
        {views.map((view) => (
          <SubscriptionAccountRow key={view.id} view={view} />
        ))}
      </ul>
    </div>
  );
}

function CredentialedSurface({ kind, onAddProvider }: ProvidersPageProps & SurfaceProps) {
  const { data: registry } = useSuspenseQuery(accountsQueryOptions);

  return (
    <div className="flex flex-col gap-3">
      <AddProviderButton onAddProvider={onAddProvider} />
      <AccountList accounts={accountsOfKind(registry.accounts, kind)} />
    </div>
  );
}

function KindSurface({ kind, onAddProvider }: ProvidersPageProps & SurfaceProps) {
  if (kind === 'local') {
    return <LocalRuntimesNote />;
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
        <p className="text-caption text-ink-secondary">{subtitles[kind]}</p>
      </header>
      <KindSurface
        kind={kind}
        onAddProvider={() => {
          setCatalogOpen(true);
        }}
      />
      <ProviderCatalogDrawer onOpenChange={setCatalogOpen} open={catalogOpen} />
    </section>
  );
}
