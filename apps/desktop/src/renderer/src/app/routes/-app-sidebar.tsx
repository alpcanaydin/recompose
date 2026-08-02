import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';
import { Suspense, useId } from 'react';

import { Icon } from '../../shared/ui';
import { GatewaySidebar } from '../../widgets/gateway/sidebar';
import { GetStartedPanel } from '../../widgets/get-started';
import { ProviderSidebar } from '../../widgets/provider/sidebar';

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
          <div aria-labelledby={systemId} className="flex flex-col gap-px" role="group">
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
