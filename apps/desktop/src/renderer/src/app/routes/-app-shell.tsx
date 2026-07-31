import { Link } from '@tanstack/react-router';
import { Suspense, useId } from 'react';

import { Icon } from '../../shared/ui';
import { GatewaySidebar } from '../../widgets/gateway/sidebar';
import { GatewayToolbar } from '../../widgets/gateway/toolbar';

const emptyChrome = <div aria-hidden className="h-toolbar" />;

type AppSidebarProps = {
  /** Asked for when a person wants a gateway beyond the ones already listed. */
  onNewGateway: () => void;
};

/** The shell's standing navigation, with the stored gateways sitting between its two groups. */
export function AppSidebar({ onNewGateway }: AppSidebarProps) {
  const systemId = useId();

  return (
    <aside className="app-drag w-60 border-e border-line-subtle bg-surface-sidebar px-2.5 pt-toolbar pb-2.5 text-body text-ink-secondary">
      <nav className="app-no-drag flex flex-col">
        <Link className="nav-item" to="/">
          <Icon name="network" />
          Gateways
        </Link>
        <Link className="nav-item" to="/providers">
          <Icon className="size-4 text-accent" name="person" />
          Providers
        </Link>
        <Suspense fallback={null}>
          <GatewaySidebar onNewGateway={onNewGateway} />
        </Suspense>
        <div aria-labelledby={systemId} className="flex flex-col" role="group">
          <h2 className="nav-group" id={systemId}>
            System
          </h2>
          <Link className="nav-item" to="/settings">
            <Icon name="gear" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}

type AppToolbarProps = {
  /** The gateway the person has selected, absent on every surface that selects none. */
  slug: string | undefined;
};

/** The strip across the top of the content area, empty chrome until a gateway is selected. */
export function AppToolbar({ slug }: AppToolbarProps) {
  return (
    <div className="app-drag shrink-0 border-b border-line-subtle bg-surface-toolbar">
      {slug === undefined ? (
        emptyChrome
      ) : (
        <Suspense fallback={emptyChrome}>
          <GatewayToolbar slug={slug} />
        </Suspense>
      )}
    </div>
  );
}
