import type { AccountKind } from '../../../../entities/account';

import { accountKindTitle } from '../../../../entities/account';
import { CredentialedSurface } from '../credentialed-surface/credentialed-surface';
import { LocalRuntimesSurface } from '../local-runtimes-surface/local-runtimes-surface';
import { SubscriptionsSurface } from '../subscriptions-surface/subscriptions-surface';

type ProvidersPageProps = {
  /** The kind a sidebar row narrowed the surface to, which the route always supplies. */
  kind: AccountKind;
};

const subtitles: Record<AccountKind, string> = {
  subscription: "Plans each provider's own command-line tool signs in and spends.",
  'api-key': 'Keys a gateway reaches one provider with, charged request by request.',
  aggregator: 'One key, many models, routed through a hosted catalog.',
  local: 'Models this machine serves itself.',
};

function kindSurface(kind: AccountKind) {
  if (kind === 'local') {
    return <LocalRuntimesSurface />;
  }

  if (kind === 'subscription') {
    return <SubscriptionsSurface />;
  }

  return <CredentialedSurface kind={kind} />;
}

/**
 * The accounts held under one kind, read under the window strip that adds another.
 *
 * @summary Reach for it from the providers route. Each kind reads as its own screen because the
 * kinds hold different things: a subscription is spent by a tool, a key is routed to by a
 * gateway, and a local runtime is neither yet. The screen itself offers nothing to press, because
 * the one way into the catalog stands in the window strip the shell owns.
 */
export function ProvidersPage({ kind }: ProvidersPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-column flex-col gap-5 px-6 pt-page-top pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-ink">{accountKindTitle(kind)}</h1>
        <p className="text-body text-ink-secondary">{subtitles[kind]}</p>
      </header>
      {kindSurface(kind)}
    </section>
  );
}
