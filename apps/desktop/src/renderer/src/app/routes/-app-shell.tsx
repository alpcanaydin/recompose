import { Link } from '@tanstack/react-router';
import { Suspense, useId } from 'react';

import { GatewaySidebar } from '../../widgets/gateway/sidebar';
import { GatewayToolbar } from '../../widgets/gateway/toolbar';

const emptyChrome = <div aria-hidden className="h-13" />;

type AppSidebarProps = {
  /** Asked for when a person wants a gateway beyond the ones already listed. */
  onNewGateway: () => void;
};

/** The shell's standing navigation, with the stored gateways sitting between its two groups. */
export function AppSidebar({ onNewGateway }: AppSidebarProps) {
  const systemId = useId();

  return (
    <aside className="app-drag w-60 border-e border-line-subtle bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
      <nav className="app-no-drag flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Link className="nav-item" to="/">
            Gateways
          </Link>
          <Link className="nav-item" to="/providers">
            Providers
          </Link>
        </div>
        <Suspense fallback={null}>
          <GatewaySidebar onNewGateway={onNewGateway} />
        </Suspense>
        <div aria-labelledby={systemId} className="flex flex-col gap-2" role="group">
          <h2 className="text-overline text-ink uppercase" id={systemId}>
            System
          </h2>
          <Link className="nav-item" to="/settings">
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
