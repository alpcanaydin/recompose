import type { ReactNode } from 'react';

import { Suspense, useSyncExternalStore } from 'react';

import { sidebarHidden, subscribeToSidebarVisibility } from '../../shared/lib';
import { SidebarToggle } from '../../shared/ui';
import { GatewayToolbar } from '../../widgets/gateway/toolbar';

const emptyChrome = <div aria-hidden className="h-toolbar" />;

type AppToolbarProps = {
  /** The gateway the person has selected, absent on every surface that selects none. */
  slug: string | undefined;
  /** The act the current surface stands at the strip's trailing edge, nothing on most surfaces. */
  trailing?: ReactNode;
};

/**
 * The strip across the top of the content area, carrying the toolbar of the selected gateway.
 *
 * @summary A surface holding no gateway carries only the drag region the hidden title bar leaves
 * it to supply. While the sidebar stands that region paints nothing, because the sidebar's own
 * band holds the control that puts it away and a bar reporting nothing reads as a mistake. Once
 * the sidebar has gone the region takes the toolbar's surface and hairline and carries the
 * control, which is then the only thing left to press. It stands as tall as that band and no
 * taller, so the control lands where the sidebar held it rather than dropping, and so the inset
 * every page leaves to clear it costs the page nothing it does not owe. It stays out of the flow
 * either way, so nothing shifts when the sidebar goes and scrolled content passes under a bar
 * rather than under a floating control.
 */
export function AppToolbar({ slug, trailing }: AppToolbarProps) {
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  if (slug === undefined) {
    return (
      <div
        className={`app-drag absolute inset-x-0 top-0 z-10 flex h-window-controls items-center ps-window-controls-width ${away ? 'border-b border-line-subtle bg-surface-toolbar' : ''}`}
      >
        {away && (
          <span className="app-no-drag flex">
            <SidebarToggle where="chrome" />
          </span>
        )}
        {trailing != null && (
          <span className="app-no-drag ms-auto flex items-center pe-3.5">{trailing}</span>
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
