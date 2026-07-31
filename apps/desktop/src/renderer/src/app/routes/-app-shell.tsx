import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';
import { Suspense, useId } from 'react';

import { Icon } from '../../shared/ui';
import { GatewaySidebar } from '../../widgets/gateway/sidebar';
import { GatewayToolbar } from '../../widgets/gateway/toolbar';
import { ProviderSidebar } from '../../widgets/provider/sidebar';

const emptyChrome = <div aria-hidden className="h-toolbar" />;

const dragRegion = <div aria-hidden className="app-drag absolute inset-x-0 top-0 z-10 h-toolbar" />;

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
        <Suspense fallback={null}>
          <GatewaySidebar onNewGateway={onNewGateway} />
        </Suspense>
        <Suspense fallback={null}>
          <ProviderSidebar />
        </Suspense>
        <div aria-labelledby={systemId} className="flex flex-col" role="group">
          <h2 className="nav-group" id={systemId}>
            System
          </h2>
          <Link className="nav-item" to="/usage">
            <Icon name="gauge" />
            Usage
          </Link>
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

/**
 * The strip across the top of the content area, carrying the toolbar of the selected gateway.
 *
 * @summary A surface holding no gateway gets no strip at all, only the drag region the hidden
 * title bar leaves it to supply. That region sits out of the flow, so the content keeps the
 * whole box rather than starting under a band that reports nothing.
 */
export function AppToolbar({ slug }: AppToolbarProps) {
  if (slug === undefined) {
    return dragRegion;
  }

  return (
    <div className="app-drag shrink-0 border-b border-line-subtle bg-surface-toolbar">
      <Suspense fallback={emptyChrome}>
        <GatewayToolbar slug={slug} />
      </Suspense>
    </div>
  );
}

type AppContentProps = {
  /** The surface a route paints, which scrolls inside the shell rather than with it. */
  children: ReactNode;
};

/** The surface every route paints on, between the toolbar strip and the foot of the shell. */
export function AppContent({ children }: AppContentProps) {
  return <div className="relative flex-1 overflow-y-auto">{children}</div>;
}
