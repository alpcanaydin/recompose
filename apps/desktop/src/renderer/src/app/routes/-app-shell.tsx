import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';
import { Suspense, useId, useSyncExternalStore } from 'react';

import { sidebarHidden, subscribeToSidebarVisibility } from '../../shared/lib';
import { Icon, SidebarToggle } from '../../shared/ui';
import { GatewaySidebar } from '../../widgets/gateway/sidebar';
import { GatewayToolbar } from '../../widgets/gateway/toolbar';
import { GetStartedPanel } from '../../widgets/get-started';
import { ProviderSidebar } from '../../widgets/provider/sidebar';

const emptyChrome = <div aria-hidden className="h-toolbar" />;

type AppSidebarProps = {
  /** Asked for when a person wants a gateway beyond the ones already listed. */
  onNewGateway: () => void;
  /** Names a fresh ask for the checklist, which the View menu raises. */
  restoreGetStarted?: string | undefined;
  /** What the top band carries, which is the sidebar control on a surface holding no toolbar. */
  band?: ReactNode;
  /** Whether the person has put the sidebar away, which it leaves and returns along. */
  away: boolean;
};

/** The shell's standing navigation, with the coaching checklist standing under it. */
export function AppSidebar({ away, band, onNewGateway, restoreGetStarted }: AppSidebarProps) {
  const systemId = useId();

  return (
    <aside
      className="sidebar-slot border-e border-line-subtle bg-surface-sidebar text-body text-ink-secondary"
      data-away={away ? '' : undefined}
      inert={away}
    >
      <div className="app-drag flex h-full w-60 flex-col px-2.5 pb-2.5">
        <div className="flex h-window-controls shrink-0 items-center justify-end">
          <span className="app-no-drag flex">{band}</span>
        </div>
        <nav className="app-no-drag flex flex-1 flex-col overflow-y-auto">
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
        <div className="app-no-drag pt-2.5">
          <Suspense fallback={null}>
            <GetStartedPanel restoreRequest={restoreGetStarted} />
          </Suspense>
        </div>
      </div>
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
 * @summary A surface holding no gateway carries only the drag region the hidden title bar leaves
 * it to supply. While the sidebar stands that region paints nothing, because the sidebar's own
 * band holds the control that puts it away and a bar reporting nothing reads as a mistake. Once
 * the sidebar has gone the region takes the toolbar's surface and hairline and carries the
 * control, which is then the only thing left to press. It stays out of the flow either way, over
 * the inset every page already leaves at its top, so nothing shifts when the sidebar goes and
 * scrolled content passes under a bar rather than under a floating control.
 */
export function AppToolbar({ slug }: AppToolbarProps) {
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  if (slug === undefined) {
    return (
      <div
        className={`app-drag absolute inset-x-0 top-0 z-10 flex h-toolbar items-center ps-window-controls-width ${away ? 'border-b border-line-subtle bg-surface-toolbar' : ''}`}
      >
        {away && (
          <span className="app-no-drag flex">
            <SidebarToggle where="standing" />
          </span>
        )}
      </div>
    );
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
